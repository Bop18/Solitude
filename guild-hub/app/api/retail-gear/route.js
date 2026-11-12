// POST /api/retail-gear  { characterId, fresh? }
// A retail character's equipped gear, live from Blizzard: name, quality, item level, icon,
// enchants and gems. Not stored in the site's (Classic) item list, so the two never mix.

import { createClient } from '@supabase/supabase-js';
import { realmSlug } from '@/lib/gearSync';

export const dynamic = 'force-dynamic';

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

const gearCache = new Map(); // characterId → { at, body }
const iconCache = new Map(); // item id → icon url (icons never change)

// Blizzard's slot names → ours, in paper-doll order
const SLOTS = [
  ['HEAD', 'Head'], ['NECK', 'Neck'], ['SHOULDER', 'Shoulder'], ['BACK', 'Back'], ['CHEST', 'Chest'],
  ['SHIRT', 'Shirt'], ['TABARD', 'Tabard'], ['WRIST', 'Wrist'], ['HANDS', 'Hands'], ['WAIST', 'Waist'],
  ['LEGS', 'Legs'], ['FEET', 'Feet'], ['FINGER_1', 'Finger 1'], ['FINGER_2', 'Finger 2'],
  ['TRINKET_1', 'Trinket 1'], ['TRINKET_2', 'Trinket 2'], ['MAIN_HAND', 'Main Hand'], ['OFF_HAND', 'Off Hand'],
];

export async function POST(request) {
  if (!process.env.BLIZZARD_CLIENT_ID || !process.env.BLIZZARD_CLIENT_SECRET) {
    return json({ error: 'Retail gear needs the Battle.net keys (see README → Battle.net).' }, 501);
  }
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Please log in again.' }, 401);
  let body = {};
  try { body = await request.json(); } catch { /* none */ }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: c } = await supabase.from('characters').select('*').eq('id', Number(body.characterId)).maybeSingle();
  if (!c) return json({ error: 'Character not found.' }, 404);
  if (!c.realm) return json({ error: `Add ${c.name}'s realm first (Edit character).` }, 400);

  const hit = gearCache.get(c.id);
  if (hit && Date.now() - hit.at < 10 * 60_000 && !body.fresh) return json(hit.body);

  const region = (process.env.BLIZZARD_REGION || 'eu').toLowerCase();
  const api = `https://${region}.api.blizzard.com`;
  try {
    const bnet = await blizzardToken();
    const headers = { Authorization: `Bearer ${bnet}` };
    const res = await fetch(`${api}/profile/wow/character/${encodeURIComponent(realmSlug(c.realm))}/${encodeURIComponent(c.name.toLowerCase())}/equipment?namespace=profile-${region}&locale=en_GB`, { headers, cache: 'no-store' });
    if (res.status === 404) return json({ error: `Blizzard couldn't find ${c.name} on ${c.realm} (${region.toUpperCase()}). Check the spelling, and log out of the character once in game.` }, 404);
    if (!res.ok) return json({ error: `Blizzard's API returned ${res.status}.` }, 502);
    const eq = await res.json();

    const items = eq.equipped_items ?? [];
    // Icons: one small lookup per item (remembered forever)
    await Promise.all(items.map(async (e) => {
      const id = e.item?.id;
      if (!id || iconCache.has(id)) return;
      const m = await fetch(`${api}/data/wow/media/item/${id}?namespace=static-${region}&locale=en_GB`, { headers, cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const icon = m?.assets?.find((a) => a.key === 'icon')?.value ?? null;
      if (icon) iconCache.set(id, icon);
    }));

    const bySlot = Object.fromEntries(items.map((e) => [e.slot?.type, e]));
    const gear = SLOTS.map(([type, label]) => {
      const e = bySlot[type];
      if (!e) return { slot: label, empty: true };
      return {
        slot: label,
        id: e.item?.id,
        name: e.name ?? e.item?.name ?? '?',
        quality: (e.quality?.type ?? 'COMMON').toLowerCase(),
        ilvl: e.level?.value ?? null,
        icon: iconCache.get(e.item?.id) ?? null,
        enchant: (e.enchantments ?? []).map((x) => x.display_string?.replace(/^Enchanted:\s*/i, '')).filter(Boolean).join(', ') || null,
        gems: (e.sockets ?? []).map((s) => s.item?.name).filter(Boolean),
        bonus: (e.bonus_list ?? []).join(':'),
        set: e.set?.item_set?.name ?? null,
      };
    }).filter((g) => !(g.empty && ['Shirt', 'Tabard', 'Off Hand'].includes(g.slot)));

    const worn = gear.filter((g) => !g.empty && !['Shirt', 'Tabard'].includes(g.slot) && g.ilvl);
    const out = {
      gear,
      avgIlvl: worn.length ? Math.round(worn.reduce((s, g) => s + g.ilvl, 0) / worn.length) : null,
      region,
      at: Date.now(),
    };
    gearCache.set(c.id, { at: Date.now(), body: out });
    return json(out);
  } catch (e) {
    return json({ error: e.message ?? 'Could not reach Blizzard.' }, 500);
  }
}
