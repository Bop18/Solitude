// POST /api/sync-character  { characterId }
// Fetches a character's level and equipped gear from Blizzard's API and saves it.
// Runs on the server so the Battle.net secret is never sent to browsers.
//
// Needs these environment variables (Vercel → Settings → Environment Variables):
//   BLIZZARD_CLIENT_ID, BLIZZARD_CLIENT_SECRET  (from https://develop.battle.net/access/clients)
//   BLIZZARD_REGION      eu | us | kr | tw              (default: eu)
//   BLIZZARD_NAMESPACE   which game version's profiles   (default: profile-classic1x = Classic Era)
//                        e.g. profile-classic for progression Classic. WoW: Forever's is not known yet;
//                        when Blizzard announces it, change this one setting.

import { createClient } from '@supabase/supabase-js';
import { applySync, realmSlug, BLIZZARD_SLOTS, QUALITY_BY_BLIZZARD } from '@/lib/gearSync';

export const dynamic = 'force-dynamic';

const json = (body, status = 200) => Response.json(body, { status });

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
  if (!character.realm) return json({ error: 'Add your realm to this character first (Edit character → Realm).' }, 400);

  const region = (process.env.BLIZZARD_REGION || 'eu').toLowerCase();
  const namespace = `${process.env.BLIZZARD_NAMESPACE || 'profile-classic1x'}-${region}`;
  const base = `https://${region}.api.blizzard.com/profile/wow/character/${encodeURIComponent(realmSlug(character.realm))}/${encodeURIComponent(character.name.toLowerCase())}`;
  const query = `?namespace=${namespace}&locale=en_GB`;

  try {
    const bnet = await blizzardToken();
    const headers = { Authorization: `Bearer ${bnet}` };
    const [profileRes, equipRes] = await Promise.all([
      fetch(base + query, { headers, cache: 'no-store' }),
      fetch(base + '/equipment' + query, { headers, cache: 'no-store' }),
    ]);

    if (profileRes.status === 404 || equipRes.status === 404) {
      return json({
        error: `Blizzard couldn't find ${character.name} on ${character.realm} (${region.toUpperCase()}). Check the name and realm spelling, and log out of the character once in game. Blizzard only updates profiles when you log out.`,
      }, 404);
    }
    if (!profileRes.ok || !equipRes.ok) {
      return json({ error: `Blizzard's API returned an error (${profileRes.status}/${equipRes.status}). It may not support this game version yet.` }, 502);
    }

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
    return json({ ok: true, level: profile.level, ...result });
  } catch (e) {
    return json({ error: e.message ?? 'Sync failed.' }, 500);
  }
}
