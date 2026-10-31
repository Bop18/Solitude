// POST /api/sync-character  { characterId }
// Fetches a character's level and equipped gear from Blizzard's API and saves it.
// Runs on the server so the Battle.net secret is never sent to browsers.
//
// Needs these environment variables (Vercel → Settings → Environment Variables):
//   BLIZZARD_CLIENT_ID, BLIZZARD_CLIENT_SECRET  (from https://develop.battle.net/access/clients)
//   BLIZZARD_REGION      eu | us | kr | tw              (default: eu)
//   BLIZZARD_NAMESPACE   optional. Which game version's profiles to look in. Leave it empty and the
//                        site tries the likely ones (see NAMESPACE_GUESSES) and remembers which worked.
//                        Set it if you want to force one, e.g. profile-classic1x (Classic Era).

import { createClient } from '@supabase/supabase-js';
import { applySync, realmSlug, BLIZZARD_SLOTS, QUALITY_BY_BLIZZARD } from '@/lib/gearSync';

export const dynamic = 'force-dynamic';

const json = (body, status = 200) => Response.json(body, { status });

// Same Battle.net API for every WoW version; the namespace picks the game.
// WoW: Forever's isn't announced yet, so try the likely names in order.
// (Retail, plain "profile", is left out on purpose so a same-named retail character can't be picked up.)
const NAMESPACE_GUESSES = ['profile-forever', 'profile-classic-forever', 'profile-classic1x', 'profile-classic', 'profile-classic-ann'];
const workingNamespace = {}; // region → namespace that last found a character
const realmCache = {};       // "ns-region" → [{ slug, name }] (null if that game version doesn't exist)

/** Every realm (or WoW: Forever ruleset server) Blizzard lists for a game version. */
async function realmsFor(ns, region, headers) {
  const key = `${ns}-${region}`;
  if (key in realmCache) return realmCache[key];
  const dynamic = ns.replace(/^profile/, 'dynamic');
  const res = await fetch(`https://${region}.api.blizzard.com/data/wow/realm/index?namespace=${dynamic}-${region}&locale=en_GB`, { headers, cache: 'no-store' });
  const list = res.ok ? ((await res.json()).realms ?? []).map((r) => ({ slug: r.slug, name: typeof r.name === 'string' ? r.name : r.name?.en_GB ?? r.name?.en_US ?? r.slug })) : null;
  realmCache[key] = list;
  return list;
}

/**
 * Which realm slugs to try for what the player typed ("Normal", "PvP", "Pyrewood Village").
 * Exact matches first, then realms whose name contains the word, then the typed text as-is.
 */
function realmCandidates(typed, realms) {
  const want = realmSlug(typed);
  const out = [];
  if (realms?.length) {
    const norm = (x) => realmSlug(x);
    for (const r of realms) if (r.slug === want || norm(r.name) === want) out.push(r.slug);
    for (const r of realms) if (!out.includes(r.slug) && (r.slug.split('-').includes(want) || norm(r.name).split('-').includes(want))) out.push(r.slug);
    // WoW: Forever might list just one server per ruleset with an unexpected name: if there's only one, try it
    if (!out.length && realms.length === 1) out.push(realms[0].slug);
  }
  if (!out.includes(want)) out.push(want);
  return out.slice(0, 3);
}

/** Name spellings to try (lower case, as Blizzard's API wants). */
function nameCandidates(name) {
  return [name.trim().toLowerCase()];
}

let cachedToken = null; // { token, expires }

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
  if (!res.ok) throw new Error(`Battle.net login failed (${res.status}). Check BLIZZARD_CLIENT_ID and BLIZZARD_CLIENT_SECRET.`);
  const data = await res.json();
  cachedToken = { token: data.access_token, expires: Date.now() + data.expires_in * 1000 };
  return cachedToken.token;
}

export async function POST(request) {
  if (!process.env.BLIZZARD_CLIENT_ID || !process.env.BLIZZARD_CLIENT_SECRET) {
    return json({ error: 'Battle.net sync isn’t set up on this site yet. Use the addon import instead, or see the README.' }, 501);
  }

  const auth = request.headers.get('authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Please log in again.' }, 401);

  let characterId;
  try {
    ({ characterId } = await request.json());
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }

  // Act as the logged-in user, so the database's normal rules apply
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData } = await supabase.auth.getUser(token);
  const userId = userData?.user?.id;
  const { data: character } = await supabase.from('characters').select('*').eq('id', characterId).maybeSingle();
  if (!character) return json({ error: 'Character not found.' }, 404);
  if (character.owner !== userId) return json({ error: 'You can only sync your own characters.' }, 403);
  if (!character.realm) return json({ error: 'Pick your ruleset (Normal, PvP…) on this character first: Edit character → Ruleset.' }, 400);

  const region = (process.env.BLIZZARD_REGION || 'eu').toLowerCase();
  const forced = process.env.BLIZZARD_NAMESPACE?.trim();
  // Retail and Classic characters have known namespaces; WoW: Forever's is guessed
  const tryList = character.game === 'retail' ? ['profile']
    : character.game === 'classic' ? ['profile-classic1x', 'profile-classic']
    : forced ? [forced]
    : [...new Set([workingNamespace[region], ...NAMESPACE_GUESSES].filter(Boolean))];

  try {
    const bnet = await blizzardToken();
    const headers = { Authorization: `Bearer ${bnet}` };
    let profileRes, equipRes, used = null, lastStatus = 404;
    const tried = [];
    search:
    for (const ns of tryList) {
      const realms = await realmsFor(ns, region, headers);
      const query = `?namespace=${ns}-${region}&locale=en_GB`;
      for (const realm of realmCandidates(character.realm, realms)) {
        for (const who of nameCandidates(character.name)) {
          const base = `https://${region}.api.blizzard.com/profile/wow/character/${encodeURIComponent(realm)}/${encodeURIComponent(who)}`;
          tried.push(`${ns}/${realm}/${who}`);
          profileRes = await fetch(base + query, { headers, cache: 'no-store' });
          if (!profileRes.ok) { lastStatus = profileRes.status; continue; }
          equipRes = await fetch(base + '/equipment' + query, { headers, cache: 'no-store' });
          if (equipRes.ok) { used = ns; break search; }
          lastStatus = equipRes.status;
        }
      }
    }

    if (!used && lastStatus === 404) {
      return json({
        error: `Blizzard couldn't find ${character.name} on ${character.realm} (${region.toUpperCase()}). Check the spelling and ruleset, and log out of the character once in game. Blizzard only updates profiles when you log out.`,
        tried: tried.slice(0, 20),
      }, 404);
    }
    if (!used) {
      return json({ error: `Blizzard's API returned an error (${lastStatus}). It may not support this game version yet.` }, 502);
    }
    if (!forced && !['retail', 'classic'].includes(character.game)) workingNamespace[region] = used;

    const profile = await profileRes.json();
    const equipment = await equipRes.json();

    const items = (equipment.equipped_items ?? [])
      .map((e) => ({
        slot: BLIZZARD_SLOTS[e.slot?.type],
        gameId: e.item?.id,
        name: e.name ?? e.item?.name ?? null,
        quality: QUALITY_BY_BLIZZARD[e.quality?.type] ?? null,
        ilvl: e.level?.value ?? null,
      }))
      .filter((i) => i.slot && i.gameId);

    const result = await applySync(supabase, character.id, { level: profile.level, items, source: 'battle.net' });
    return json({ ok: true, level: profile.level, namespace: used, ...result });
  } catch (e) {
    return json({ error: e.message ?? 'Sync failed.' }, 500);
  }
}
