// POST /api/retail-journal
//   { step: 'list' }            → this season's retail dungeons and raids
//   { step: 'instance', id }    → load one of them: bosses (in order) and their loot, saved to the site
// Data comes from Blizzard's Adventure Journal. Done one instance per request so each stays quick.
// Uses BLIZZARD_CLIENT_ID / BLIZZARD_CLIENT_SECRET / BLIZZARD_REGION.

import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const json = (body, status = 200) => Response.json(body, { status });

let cachedToken = null;
async function blizzardToken() {
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.token;
  const res = await fetch('https://oauth.battle.net/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${process.env.BLIZZARD_CLIENT_ID}:${process.env.BLIZZARD_CLIENT_SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Battle.net login failed (${res.status}).`);
  const data = await res.json();
  cachedToken = { token: data.access_token, expires: Date.now() + data.expires_in * 1000 };
  return cachedToken.token;
}

// Blizzard inventory types → the slot names the site uses
const SLOT = {
  HEAD: 'Head', NECK: 'Neck', SHOULDER: 'Shoulder', CLOAK: 'Back', CHEST: 'Chest', ROBE: 'Chest', WRIST: 'Wrist',
  HAND: 'Hands', WAIST: 'Waist', LEGS: 'Legs', FEET: 'Feet', FINGER: 'Finger', TRINKET: 'Trinket',
  WEAPON: 'One-Hand', TWOHWEAPON: 'Two-Hand', WEAPONMAINHAND: 'Main Hand', WEAPONOFFHAND: 'Off Hand',
  HOLDABLE: 'Held In Off-hand', SHIELD: 'Off Hand', RANGED: 'Ranged', RANGEDRIGHT: 'Ranged',
};
const QUALITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const quality = (q) => {
  const t = (q ?? '').toLowerCase();
  if (QUALITIES.includes(t)) return t;
  if (t === 'artifact' || t === 'heirloom') return 'legendary';
  return t === 'poor' ? 'common' : 'epic';
};

/** Run async jobs a few at a time (Blizzard allows ~100 requests a second). */
async function pool(list, size, fn) {
  const out = new Array(list.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, list.length) }, async () => {
    while (i < list.length) { const n = i++; out[n] = await fn(list[n], n); }
  }));
  return out;
}

export async function POST(request) {
  if (!process.env.BLIZZARD_CLIENT_ID || !process.env.BLIZZARD_CLIENT_SECRET) {
    return json({ error: 'This needs the Battle.net keys (see README → Battle.net).' }, 501);
  }
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Please log in again.' }, 401);
  let body = {};
  try { body = await request.json(); } catch { /* none */ }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: who } = await supabase.auth.getUser(token);
  if (!who?.user) return json({ error: 'Please log in again.' }, 401);

  const region = (process.env.BLIZZARD_REGION || 'eu').toLowerCase();
  const bnet = await blizzardToken();
  const get = (path) => fetch(`https://${region}.api.blizzard.com/data/wow/${path}${path.includes('?') ? '&' : '?'}namespace=static-${region}&locale=en_GB`,
    { headers: { Authorization: `Bearer ${bnet}` }, cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

  try {
    if (body.step === 'list') {
      const index = await get('journal-expansion/index');
      const tiers = index?.tiers ?? [];
      const season = tiers.find((t) => /current season/i.test(t.name ?? ''))
        ?? tiers.filter((t) => !/current season/i.test(t.name ?? '')).reduce((a, b) => (b.id > a.id ? b : a), tiers[0]);
      if (!season) return json({ error: 'Could not read Blizzard’s Adventure Journal.' }, 502);
      const exp = await get(`journal-expansion/${season.id}`);
      const instances = [
        ...(exp?.raids ?? []).map((r) => ({ id: r.id, name: r.name, kind: 'raid' })),
        ...(exp?.dungeons ?? []).map((d) => ({ id: d.id, name: d.name, kind: 'dungeon' })),
      ];
      return json({ season: season.name, instances });
    }

    if (body.step === 'instance') {
      const id = Number(body.id);
      const inst = await get(`journal-instance/${id}`);
      if (!inst) return json({ error: `Couldn't read instance ${id}.` }, 502);
      const kind = inst.category?.type === 'RAID' || body.kind === 'raid' ? 'raid' : 'dungeon';

      // The dungeon row (by journal id, or by name if it was made before)
      let { data: dungeon } = await supabase.from('dungeons').select('id').eq('journal_id', id).maybeSingle();
      if (!dungeon) ({ data: dungeon } = await supabase.from('dungeons').select('id').eq('name', inst.name).maybeSingle());
      const row = { name: inst.name, kind, size: kind === 'raid' ? 20 : 5, game: 'retail', journal_id: id, min_level: inst.minimum_level ?? null, max_level: null };
      if (dungeon) {
        const { error } = await supabase.from('dungeons').update(row).eq('id', dungeon.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('dungeons').insert(row).select('id').single();
        if (error) throw error;
        dungeon = data;
      }

      // Bosses in order, and what each drops
      const encounters = inst.encounters ?? [];
      const drops = []; // { itemId, name, boss, order }
      await pool(encounters, 6, async (e, n) => {
        const enc = await get(`journal-encounter/${e.id}`);
        for (const it of enc?.items ?? []) {
          if (it.item?.id) drops.push({ itemId: it.item.id, name: it.item.name, boss: e.name, order: n + 1 });
        }
      });
      const unique = [...new Map(drops.map((d) => [d.itemId, d])).values()];

      // Details + icon for each item
      const rows = (await pool(unique, 20, async (d) => {
        const [item, media] = await Promise.all([get(`item/${d.itemId}`), get(`media/item/${d.itemId}`)]);
        const iconUrl = media?.assets?.find((a) => a.key === 'icon')?.value ?? '';
        const slot = SLOT[item?.inventory_type?.type] ?? null;
        return {
          game_id: d.itemId,
          name: item?.name ?? d.name ?? `Item ${d.itemId}`,
          quality: quality(item?.quality?.type),
          ilvl: item?.level ?? null,
          req_level: item?.required_level ?? null,
          slot,
          kind: item?.item_class?.name ?? null,
          item_type: item?.item_subclass?.name ?? null,
          icon: iconUrl.split('/').pop()?.replace(/\.jpg$/, '') || null,
          boss: d.boss,
          boss_order: d.order,
          dungeon_id: dungeon.id,
          link: `https://www.wowhead.com/item=${d.itemId}`,
        };
      })); // everything, including tier tokens and mounts people may want

      for (let i = 0; i < rows.length; i += 100) {
        const { error } = await supabase.from('items').upsert(rows.slice(i, i + 100), { onConflict: 'game_id' });
        if (error) throw error;
      }
      return json({ ok: true, dungeonId: dungeon.id, name: inst.name, kind, bosses: encounters.length, items: rows.length });
    }

    return json({ error: 'Unknown step.' }, 400);
  } catch (e) {
    const msg = e.message ?? String(e);
    return json({ error: /game|journal_id|boss_order/.test(msg) ? 'Run supabase/schema-18-retail-loot.sql in Supabase first.' : msg }, 500);
  }
}
