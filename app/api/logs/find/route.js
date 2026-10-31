// POST /api/logs/find  { characterId? }
// Asks Warcraft Logs for recent reports that the logged-in player's characters appear in
// (or just one character), and saves every one it finds on the Logs page (link + title + date;
// the full breakdown is read the first time someone opens it).
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
    recentReports(limit: 50) { data { code title startTime endTime zone { name } } }
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

  let body = {};
  try { body = await request.json(); } catch { /* no body */ }
  let q = supabase.from('characters').select('id, name, realm').eq('owner', userId);
  if (body.characterId) q = q.eq('id', Number(body.characterId));
  const { data: chars } = await q;
  if (!chars?.length) return json({ reports: [], searched: [], note: 'Add your characters on the Roster first.' });

  const region = (process.env.WCL_REGION || process.env.BLIZZARD_REGION || 'EU').toUpperCase();
  const sites = (process.env.WCL_SITES || 'classic.warcraftlogs.com,fresh.warcraftlogs.com,www.warcraftlogs.com')
    .split(',').map((s) => s.trim()).filter(Boolean);

  const wcl = await wclToken();
  const found = new Map(); // code → report
  const searched = [];
  const notFound = [];

  const details = []; // what happened for each character, shown on the page

  // Realms we've already seen each character on, from logs saved on the site
  // (helps when the realm on the Roster is wrong or is a WoW: Forever ruleset).
  const seenRealms = {};
  {
    const { data: saved } = await supabase.from('logs').select('players:data->players').not('data', 'is', null).limit(300);
    for (const row of saved ?? []) {
      for (const p of row.players ?? []) {
        if (!p?.name || !p.server) continue;
        const key = p.name.toLowerCase();
        // Warcraft Logs writes realms without spaces ("TwistingNether"): try it with spaces too
        const spaced = p.server.replace(/([a-z])([A-Z])/g, '$1 $2');
        (seenRealms[key] ??= new Set()).add(spaced);
        seenRealms[key].add(p.server);
      }
    }
  }

  await Promise.all(chars.map(async (c) => {
    const pretty = {}; // slug → nice name to save back on the character
    for (const r of [c.realm, ...(seenRealms[c.name.toLowerCase()] ?? [])].filter(Boolean)) pretty[realmSlug(r)] ??= r;
    const realmsToTry = Object.keys(pretty);
    if (!realmsToTry.length) { notFound.push(`${c.name} (no realm set)`); details.push(`${c.name}: add its realm on the Roster.`); return; }
    let hit = false;
    const problems = [];
    let server = realmsToTry[0];
    search:
    for (const realm of realmsToTry) for (const site of sites) {
      server = realm;
      try {
        const res = await fetch(`https://${site}/api/v2/client`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${wcl}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: QUERY, variables: { name: c.name, server, region } }),
          cache: 'no-store',
        });
        const body = await res.json().catch(() => ({}));
        if (body?.errors?.length) problems.push(`${site}: ${body.errors[0].message}`);
        else if (!res.ok) problems.push(`${site}: HTTP ${res.status}`);
        const ch = body?.data?.characterData?.character;
        if (!ch) continue;
        hit = true;
        if (realm !== realmSlug(c.realm ?? '')) {
          // Remember the realm that worked so next time is quicker
          await supabase.from('characters').update({ realm: pretty[realm] }).eq('id', c.id);
        }
        const list = ch.recentReports?.data ?? [];
        details.push(`${c.name} found on ${site} (${server}, ${region}): ${list.length} report${list.length === 1 ? '' : 's'}.`);
        for (const r of list) {
          const prev = found.get(r.code);
          found.set(r.code, {
            code: r.code,
            url: `https://${site}/reports/${r.code}`,
            title: r.title,
            zone: r.zone?.name ?? null,
            start: r.startTime,
            end: r.endTime,
            characters: [...new Set([...(prev?.characters ?? []), c.name])],
            characterIds: [...new Set([...(prev?.characterIds ?? []), c.id])],
          });
        }
        break search;
      } catch (e) {
        problems.push(`${site}: ${e.message}`);
      }
    }
    if (!hit) {
      details.push(`${c.name} not found on realm ${realmsToTry.map((r) => `"${r}"`).join(' or ')} in ${region}${problems.length ? ` (${problems.join('; ')})` : ''}.`);
    }
    (hit ? searched : notFound).push(c.name);
  }));

  const reports = [...found.values()].sort((a, b) => (b.start ?? 0) - (a.start ?? 0));

  // Save them all: new ones as "not read yet", and tag existing ones with the character
  let added = 0;
  if (reports.length) {
    const { data: existing, error } = await supabase.from('logs').select('id, code, found_for').in('code', reports.map((r) => r.code));
    if (error) return json({ error: error.message.includes('found_for') ? 'Run supabase/schema-14-log-characters.sql in Supabase first.' : error.message }, 500);
    const byCode = Object.fromEntries((existing ?? []).map((l) => [l.code, l]));
    const fresh = reports.filter((r) => !byCode[r.code]).map((r) => ({
      code: r.code,
      url: r.url,
      title: r.title,
      zone: r.zone,
      started_at: r.start ? new Date(r.start).toISOString() : null,
      ended_at: r.end ? new Date(r.end).toISOString() : null,
      found_for: r.characterIds,
    }));
    if (fresh.length) {
      const { error: insErr } = await supabase.from('logs').insert(fresh);
      if (insErr) return json({ error: insErr.message }, 500);
      added = fresh.length;
    }
    for (const r of reports.filter((x) => byCode[x.code])) {
      const have = byCode[r.code].found_for ?? [];
      const merged = [...new Set([...have, ...r.characterIds])];
      if (merged.length !== have.length) await supabase.from('logs').update({ found_for: merged }).eq('id', byCode[r.code].id);
    }
  }
  return json({ reports, added, searched, notFound, region, details });
}
