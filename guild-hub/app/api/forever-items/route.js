// POST /api/forever-items — fills in WoW: Forever items (icon, quality, item level, stats)
// from Blizzard's item data. Only touches items that have a game ID but no icon or stats yet.
// Runs a batch per call; the client calls again while `remaining` > 0.
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

const SLOT = {
  HEAD: 'Head', NECK: 'Neck', SHOULDER: 'Shoulder', CLOAK: 'Back', CHEST: 'Chest', ROBE: 'Chest', WRIST: 'Wrist',
  HAND: 'Hands', WAIST: 'Waist', LEGS: 'Legs', FEET: 'Feet', FINGER: 'Finger', TRINKET: 'Trinket',
  WEAPON: 'One-Hand', TWOHWEAPON: 'Two-Hand', WEAPONMAINHAND: 'Main Hand', WEAPONOFFHAND: 'Off Hand',
  HOLDABLE: 'Held In Off-hand', SHIELD: 'Off Hand', RANGED: 'Ranged', RANGEDRIGHT: 'Ranged', THROWN: 'Ranged', RELIC: 'Relic',
};
const STAT = {
  STAMINA: 'sta', STRENGTH: 'str', AGILITY: 'agi', INTELLECT: 'int', SPIRIT: 'spi',
  CRIT_RATING: 'crit', HIT_RATING: 'hit', DEFENSE_SKILL_RATING: 'def', DODGE_RATING: 'dodge', PARRY_RATING: 'parry',
  BLOCK_RATING: 'block', ATTACK_POWER: 'ap', SPELL_POWER: 'sp', HASTE_RATING: 'haste',
  FIRE_RESISTANCE: 'fireRes', FROST_RESISTANCE: 'frostRes', SHADOW_RESISTANCE: 'shadowRes', NATURE_RESISTANCE: 'natureRes', ARCANE_RESISTANCE: 'arcaneRes',
};
const QUALITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

/** Spell-power / healing / mp5 / hit lines that Classic-style items list as "Equip:" text */
function equipStats(spells = []) {
  const out = {};
  for (const s of spells) {
    const t = (s.description ?? '').toLowerCase();
    let m;
    if ((m = t.match(/damage and healing done by magical spells and effects by up to (\d+)/)) || (m = t.match(/increases spell power by (\d+)/))) out.sp = (out.sp ?? 0) + +m[1];
    else if ((m = t.match(/healing done by spells and effects by up to (\d+)/))) out.heal = (out.heal ?? 0) + +m[1];
    if ((m = t.match(/restores (\d+) mana per 5 sec/))) out.mp5 = (out.mp5 ?? 0) + +m[1];
    if ((m = t.match(/improves your chance to hit by (\d+)%/))) out.hit = (out.hit ?? 0) + +m[1];
    if ((m = t.match(/improves your chance to get a critical strike(?: with spells)? by (\d+)%/))) out.crit = (out.crit ?? 0) + +m[1];
    if ((m = t.match(/\+(\d+) attack power/))) out.ap = (out.ap ?? 0) + +m[1];
  }
  return out;
}

export async function POST(request) {
  if (!process.env.BLIZZARD_CLIENT_ID || !process.env.BLIZZARD_CLIENT_SECRET) return json({ error: 'Battle.net keys missing.' }, 501);
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Please log in again.' }, 401);
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: who } = await supabase.auth.getUser(token);
  if (!who?.user) return json({ error: 'Please log in again.' }, 401);

  let body = {};
  try { body = await request.json(); } catch { /* none */ }
  const after = Math.max(200000, Number(body.after ?? 0) + 1); // page through, so unknown items don't block the rest
  const region = (process.env.BLIZZARD_REGION || 'eu').toLowerCase();

  const bnet = await blizzardToken();
  const headers = { Authorization: `Bearer ${bnet}` };
  const ns = await foreverNamespace(region, headers);
  if (!ns.name) return json({ ok: false, error: `Blizzard's WoW: Forever item data wasn't found (${ns.tried.join(', ')}).`, tried: ns.tried, done: true });
  const get = (path, extra = '') => fetch(`https://${region}.api.blizzard.com/data/wow/${path}?namespace=${ns.name}&locale=en_GB${extra}`, { headers, cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null)).catch(() => null);

  // 1. WoW: Forever loot typed in by name only: look up its game ID by name
  let identified = 0;
  if (!body.after) {
    const { data: forever } = await supabase.from('dungeons').select('id').ilike('notes', '%forever%');
    const ids = (forever ?? []).map((d) => d.id);
    if (ids.length) {
      const { data: unnamed } = await supabase.from('items').select('id, name').is('game_id', null).in('dungeon_id', ids).limit(40);
      await Promise.all((unnamed ?? []).map(async (it) => {
        const res = await get('search/item', `&name.en_GB=${encodeURIComponent(it.name)}&orderby=id:desc&_pageSize=20`);
        const hit = (res?.results ?? []).map((r) => r.data).find((d) => (typeof d?.name === 'string' ? d.name : d?.name?.en_GB ?? d?.name?.en_US ?? '').toLowerCase() === it.name.toLowerCase());
        if (!hit?.id) return;
        const { error: e } = await supabase.from('items').update({ game_id: hit.id }).eq('id', it.id);
        if (!e) identified++;
      }));
    }
  }

  // 2. Icon, quality, item level and stats for WoW: Forever items (the new, high item IDs)
  const { data: todo, error } = await supabase.from('items').select('id, game_id, name, slot, item_type, kind, stats, icon')
    .gte('game_id', after).is('icon', null).order('game_id').limit(40);
  if (error) return json({ error: error.message }, 500);
  if (!todo?.length) return json({ ok: true, namespace: ns.name, identified, filled: 0, done: true });

  let filled = 0, missing = 0;
  await Promise.all(todo.map(async (it) => {
    const [item, media] = await Promise.all([get(`item/${it.game_id}`), get(`media/item/${it.game_id}`)]);
    if (!item) { missing++; return; }
    const p = item.preview_item ?? {};
    const stats = { ...(it.stats ?? {}) };
    for (const s of p.stats ?? []) { const k = STAT[s.type?.type]; if (k) stats[k] = (stats[k] ?? 0) + (s.value ?? 0); }
    if (p.armor?.value) stats.armor = p.armor.value;
    Object.assign(stats, equipStats(p.spells));
    const q = (item.quality?.type ?? '').toLowerCase();
    const icon = (media?.assets?.find((a) => a.key === 'icon')?.value ?? '').split('/').pop()?.replace(/\.jpg$/, '') || '';
    const patch = {
      name: item.name ?? it.name,
      quality: QUALITIES.includes(q) ? q : q === 'poor' ? 'common' : 'rare',
      ilvl: item.level ?? null,
      req_level: item.required_level ?? null,
      slot: SLOT[item.inventory_type?.type] ?? it.slot,
      kind: item.item_class?.name ?? it.kind,
      item_type: item.item_subclass?.name ?? it.item_type,
      stats,
      dps: p.weapon?.dps?.value ?? null,
      speed: p.weapon?.attack_speed?.value ? p.weapon.attack_speed.value / 1000 : null,
      icon: icon || 'inv_misc_questionmark',
    };
    const { error: e } = await supabase.from('items').update(patch).eq('id', it.id);
    if (!e) filled++;
  }));
  return json({ ok: true, namespace: ns.name, identified, filled, notFound: missing, after: todo[todo.length - 1].game_id, done: todo.length < 40 });
}

// Which of Blizzard's item-data names WoW: Forever uses: test with a known WoW: Forever item (Reliquary Mantle)
let nsCache = null;
async function foreverNamespace(region, headers) {
  if (nsCache?.name) return nsCache;
  const candidates = [process.env.BLIZZARD_FOREVER_STATIC, `static-forever-${region}`, `static-classic-forever-${region}`,
    `static-1.60.1_70399-forever-${region}`, `static-classic1x-${region}`, `static-classic-${region}`].filter(Boolean);
  const tried = [];
  for (const name of candidates) {
    const r = await fetch(`https://${region}.api.blizzard.com/data/wow/item/273028?namespace=${name}&locale=en_GB`, { headers, cache: 'no-store' }).catch(() => null);
    tried.push(`${name} → ${r?.status ?? 'no answer'}`);
    if (r?.ok) { nsCache = { name, tried }; return nsCache; }
  }
  return { name: null, tried };
}
