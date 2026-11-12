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
import { syncCharacter } from '@/lib/bnetSync';

export const dynamic = 'force-dynamic';

const json = (body, status = 200) => Response.json(body, { status });

export async function POST(request) {
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
  if (!character.realm && character.game !== 'forever') return json({ error: 'Pick your ruleset (Normal, PvP…) on this character first: Edit character → Ruleset.' }, 400);

  const { status, body } = await syncCharacter(supabase, character);
  return json(body, status);
}
