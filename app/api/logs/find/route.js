// POST /api/logs/find
// Asks Warcraft Logs for recent reports that the logged-in player's characters appear in.
// Uses the same WCL_CLIENT_ID / WCL_CLIENT_SECRET as /api/logs.
//   WCL_REGION  optional: EU (default), US, KR, TW, CN
//   WCL_SITES   optional: which Warcraft Logs sites to search, comma-separated
//               (default: classic, fresh, www). WoW: Forever's site isn't announced yet;
//               add its address here once it is, e.g. "forever.warcraftlogs.com".

import { createClient } from '@supabase/supabase-js';
import { realmSlug } from '@/lib/gearSync';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const json = (body, status = 200) => Response.json(body, { status });

let cachedToken = null;
async function wclToken() {
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.token;
  const res = await fetch('https://www.warcraftlogs.com/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${process.env.WCL_CLIENT_ID}:${process.env.WCL_CLIENT_SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Warcraft Logs login failed (${res.status}).`);
  const data = await res.json();
  cachedToken = { token: data.access_token, expires: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cachedToken.token;
}

const QUERY = `query($name: String!, $server: String!, $region: String!) {
  characterData { character(name: $name, serverSlug: $server, serverRegion: $region) {
    name
    recentReports(limit: 25) { data { code title startTime endTime zone { name } } }
  } }
}`;

export async function POST(request) {
  if (!process.env.WCL_CLIENT_ID || !process.env.WCL_CLIENT_SECRET) {
    return json({ error: 'Add the Warcraft Logs keys to the site first (see README → Warcraft Logs).' }, 501);
  }
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Please log in again.' }, 401);

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData } = await supabase.auth.getUser(token);
  const userId = userData?.user?.id;
  if (!userId) return json({ error: 'Please log in again.' }, 401);

  const { data: chars } = await supabase.from('characters').select('id, name, realm').eq('owner', userId);
  if (!chars?.length) return json({ reports: [], searched: [], note: 'Add your characters on the Roster first.' });

  const region = (process.env.WCL_REGION || process.env.BLIZZARD_REGION || 'EU').toUpperCase();
  const sites = (process.env.WCL_SITES || 'classic.warcraftlogs.com,fresh.warcraftlogs.com,www.warcraftlogs.com')
    .split(',').map((s) => s.trim()).filter(Boolean);

  const wcl = await wclToken();
  const found = new Map(); // code → report
  const searched = [];
  const notFound = [];

  await Promise.all(chars.map(async (c) => {
    if (!c.realm) { notFound.push(`${c.name} (no ruleset/realm set)`); return; }
    let hit = false;
    for (const site of sites) {
      try {
        const res = await fetch(`https://${site}/api/v2/client`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${wcl}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: QUERY, variables: { name: c.name, server: realmSlug(c.realm), region } }),
          cache: 'no-store',
        });
        const body = await res.json().catch(() => ({}));
        const ch = body?.data?.characterData?.character;
        if (!ch) continue;
        hit = true;
        for (const r of ch.recentReports?.data ?? []) {
          const prev = found.get(r.code);
          found.set(r.code, {
            code: r.code,
            url: `https://${site}/reports/${r.code}`,
            title: r.title,
            zone: r.zone?.name ?? null,
            start: r.startTime,
            end: r.endTime,
            characters: [...new Set([...(prev?.characters ?? []), c.name])],
          });
        }
      } catch { /* try the next site */ }
    }
    (hit ? searched : notFound).push(c.name);
  }));

  const reports = [...found.values()].sort((a, b) => (b.start ?? 0) - (a.start ?? 0));
  return json({ reports, searched, notFound, region });
}
