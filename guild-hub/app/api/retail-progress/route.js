// POST /api/retail-progress  { characterId }
// A retail character's progress from Blizzard's retail API:
// Mythic+ runs this week, M+ rating, raid progress (bosses killed this week) and item level.
// Uses the same BLIZZARD_CLIENT_ID / BLIZZARD_CLIENT_SECRET / BLIZZARD_REGION as gear sync.

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

/** Retail weekly reset: EU Wednesday 04:00 UTC, US/other Tuesday 15:00 UTC. */
function lastRetailReset(region, now = new Date()) {
  const eu = region === 'eu';
  const day = eu ? 3 : 2;
  const hour = eu ? 4 : 15;
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour));
  while (d.getUTCDay() !== day || d > now) d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

const cache = new Map(); // characterId → { at, body }

// The current season's raids, from Blizzard's Adventure Journal (changes a few times a year).
let seasonCache = null; // { at, region, data }
async function currentSeasonRaids(region, bnet) {
  if (seasonCache && seasonCache.region === region && Date.now() - seasonCache.at < 6 * 3600e3) return seasonCache.data;
  const get = (path) => fetch(`https://${region}.api.blizzard.com/data/wow/${path}${path.includes('?') ? '&' : '?'}namespace=static-${region}&locale=en_GB`,
    { headers: { Authorization: `Bearer ${bnet}` }, cache: 'no-store' }).then((r) => (r.ok ? r.json() : null));
  const index = await get('journal-expansion/index');
  const tiers = index?.tiers ?? [];
  if (!tiers.length) return null;
  const real = tiers.filter((t) => !/current season/i.test(t.name ?? ''));
  const newest = real.reduce((a, b) => (b.id > a.id ? b : a), real[0]);
  // Blizzard lists a "Current Season" entry with this season's raids; otherwise use the newest expansion
  const season = tiers.find((t) => /current season/i.test(t.name ?? '')) ?? newest;
  const exp = await get(`journal-expansion/${season.id}`);
  const raids = await Promise.all((exp?.raids ?? []).map(async (r) => {
    const inst = await get(`journal-instance/${r.id}`);
    return { id: r.id, name: r.name, bosses: (inst?.encounters ?? []).map((e) => e.name) };
  }));
  const data = { expansion: newest?.name ?? null, raids };
  if (raids.length) seasonCache = { at: Date.now(), region, data };
  return data;
}

export async function POST(request) {
  if (!process.env.BLIZZARD_CLIENT_ID || !process.env.BLIZZARD_CLIENT_SECRET) {
    return json({ error: 'Retail progress needs the Battle.net keys (see README → Battle.net).' }, 501);
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
  if (!c.realm) return json({ error: `Add ${c.name}'s realm on the Roster first.` }, 400);

  const hit = cache.get(c.id);
  if (hit && Date.now() - hit.at < 5 * 60_000 && !body.fresh) return json(hit.body);

  const region = (process.env.BLIZZARD_REGION || 'eu').toLowerCase();
  const base = `https://${region}.api.blizzard.com/profile/wow/character/${encodeURIComponent(realmSlug(c.realm))}/${encodeURIComponent(c.name.toLowerCase())}`;
  const q = `?namespace=profile-${region}&locale=en_GB`;

  try {
    const bnet = await blizzardToken();
    const get = (path) => fetch(base + path + q, { headers: { Authorization: `Bearer ${bnet}` }, cache: 'no-store' })
      .then(async (r) => (r.ok ? r.json() : { _status: r.status }));
    const [summary, mplus, raids] = await Promise.all([get(''), get('/mythic-keystone-profile'), get('/encounters/raids')]);

    if (summary._status === 404) {
      return json({ error: `Blizzard couldn't find ${c.name} on ${c.realm} (${region.toUpperCase()}). Check the spelling, and log out of the character once in game.` }, 404);
    }
    if (summary._status) return json({ error: `Blizzard's API returned ${summary._status}.` }, 502);

    const reset = lastRetailReset(region);
    const weekRuns = (mplus.current_period?.best_runs ?? []).map((r) => ({
      dungeon: r.dungeon?.name ?? '?',
      level: r.keystone_level,
      timed: !!r.is_completed_within_time,
      at: r.completed_timestamp,
      duration: r.duration,
      rating: r.mythic_rating?.rating ?? r.map_rating?.rating ?? null,
    })).sort((a, b) => b.level - a.level || b.at - a.at);

    const modesOf = (inst, bosses = []) => (inst?.modes ?? []).map((m) => {
      const killed = Object.fromEntries((m.progress?.encounters ?? []).map((e) => [e.encounter?.name, e]));
      // Every boss in journal order (Blizzard's profile only lists the ones you've killed)
      const names = bosses.length ? [...bosses, ...Object.keys(killed).filter((n) => !bosses.includes(n))] : Object.keys(killed);
      const encounters = names.map((name) => {
        const e = killed[name];
        return {
          name,
          kills: e?.completed_count ?? 0,
          lastKill: e?.last_kill_timestamp ?? null,
          thisWeek: !!e?.last_kill_timestamp && e.last_kill_timestamp >= reset.getTime(),
        };
      });
      return {
        difficulty: m.difficulty?.name ?? m.difficulty?.type ?? '?',
        type: m.difficulty?.type ?? null,
        done: m.progress?.completed_count ?? 0,
        total: m.progress?.total_count ?? (bosses.length || encounters.length),
        thisWeek: encounters.filter((e) => e.thisWeek).length,
        encounters,
      };
    });

    // The character's progress per raid (any expansion), by journal instance id
    const progressById = {};
    for (const exp of raids.expansions ?? []) for (const inst of exp.instances ?? []) progressById[inst.instance?.id] = inst;

    let raidList;
    let expansionName;
    const season = await currentSeasonRaids(region, bnet).catch(() => null);
    if (season?.raids?.length) {
      // This season's raids, even ones the character hasn't set foot in yet
      expansionName = season.expansion;
      raidList = season.raids.map((r) => ({ name: r.name, bosses: r.bosses, modes: modesOf(progressById[r.id], r.bosses) }));
    } else {
      // Couldn't read the journal: fall back to the newest expansion the character has kills in
      const expansions = raids.expansions ?? [];
      const current = expansions[expansions.length - 1];
      expansionName = current?.expansion?.name ?? null;
      raidList = (current?.instances ?? []).map((inst) => ({ name: inst.instance?.name ?? '?', bosses: [], modes: modesOf(inst) }));
    }

    const out = {
      id: c.id,
      name: summary.name ?? c.name,
      realm: summary.realm?.name ?? c.realm,
      level: summary.level ?? c.level,
      ilvl: summary.equipped_item_level ?? summary.average_item_level ?? null,
      spec: summary.active_spec?.name ?? null,
      class: summary.character_class?.name ?? c.class,
      rating: mplus.current_mythic_rating?.rating ?? null,
      ratingColor: mplus.current_mythic_rating?.color ?? null,
      weekRuns,
      expansion: expansionName,
      raids: raidList,
      resetAt: reset.getTime(),
      region,
    };
    cache.set(c.id, { at: Date.now(), body: out });

    // Keep the roster up to date (only works for your own characters)
    if (out.level && out.level !== c.level) await supabase.from('characters').update({ level: out.level }).eq('id', c.id);
    return json(out);
  } catch (e) {
    return json({ error: e.message ?? 'Could not reach Blizzard.' }, 500);
  }
}
