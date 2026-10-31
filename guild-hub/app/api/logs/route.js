// POST /api/logs  { url, eventId?, keep? }
// Reads a Warcraft Logs report and saves a summary of it in our database,
// so it's easy to read and kept even if the report is deleted later.
//
// Needs (Vercel → Settings → Environment Variables), from https://www.warcraftlogs.com/api/clients :
//   WCL_CLIENT_ID, WCL_CLIENT_SECRET
// Without them the link is still saved, just without the breakdown.

import { createClient } from '@supabase/supabase-js';
import { parseReportUrl, buildSummary } from '@/lib/wcl';

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
  if (!res.ok) throw new Error(`Warcraft Logs login failed (${res.status}). Check WCL_CLIENT_ID and WCL_CLIENT_SECRET.`);
  const data = await res.json();
  cachedToken = { token: data.access_token, expires: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cachedToken.token;
}

// Each Warcraft Logs site (classic., fresh., sod., www.) has its own API address.
async function gql(host, query, variables) {
  const token = await wclToken();
  const hosts = [...new Set([host, 'www.warcraftlogs.com'])];
  let lastError = null;
  for (const h of hosts) {
    const res = await fetch(`https://${h}/api/v2/client`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      cache: 'no-store',
    });
    const body = await res.json().catch(() => ({}));
    const report = body?.data?.reportData?.report;
    if (res.ok && report) return report;
    lastError = body?.errors?.[0]?.message ?? `Warcraft Logs returned ${res.status}`;
  }
  throw new Error(lastError ?? 'Report not found.');
}

const META = `query($code: String!) { reportData { report(code: $code) {
  title startTime endTime
  zone { name }
  owner { name }
  fights { id name kill startTime endTime encounterID fightPercentage size friendlyPlayers }
  masterData { actors(type: "Player") { id name subType server icon } }
} } }`;

async function readReport(host, code) {
  const report = await gql(host, META, { code });
  const fights = report.fights ?? [];
  const allIds = fights.map((f) => f.id);
  const bosses = fights.filter((f) => f.encounterID > 0).slice(0, 60);

  // Ask for the tables in batches (Warcraft Logs limits how much one query can do)
  const wanted = [];
  if (allIds.length) {
    const ids = `[${allIds.join(',')}]`;
    wanted.push(`all_d: table(dataType: DamageDone, fightIDs: ${ids})`);
    wanted.push(`all_h: table(dataType: Healing, fightIDs: ${ids})`);
    wanted.push(`all_x: table(dataType: Deaths, fightIDs: ${ids})`);
  }
  for (const f of bosses) {
    wanted.push(`f${f.id}_d: table(dataType: DamageDone, fightIDs: [${f.id}])`);
    wanted.push(`f${f.id}_h: table(dataType: Healing, fightIDs: [${f.id}])`);
    wanted.push(`f${f.id}_x: table(dataType: Deaths, fightIDs: [${f.id}])`);
  }
  const tables = {};
  for (let i = 0; i < wanted.length; i += 24) {
    const part = await gql(host, `query($code: String!) { reportData { report(code: $code) { ${wanted.slice(i, i + 24).join('\n')} } } }`, { code });
    Object.assign(tables, part);
  }
  return buildSummary(report, tables, { host });
}

export async function POST(request) {
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Please log in again.' }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Bad request.' }, 400); }

  const parsed = parseReportUrl(body.url);
  if (!parsed) return json({ error: 'That doesn’t look like a Warcraft Logs report link. It should look like https://classic.warcraftlogs.com/reports/AbC123…' }, 400);

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData } = await supabase.auth.getUser(token);
  if (!userData?.user) return json({ error: 'Please log in again.' }, 401);

  const { data: existing, error: findErr } = await supabase.from('logs').select('id').eq('code', parsed.code).maybeSingle();
  if (findErr) {
    return json({ error: findErr.message.includes('logs') ? 'Run supabase/schema-13-logs.sql in Supabase first.' : findErr.message }, 500);
  }

  let summary = null;
  let warning = null;
  if (process.env.WCL_CLIENT_ID && process.env.WCL_CLIENT_SECRET) {
    try {
      summary = await readReport(parsed.host, parsed.code);
    } catch (e) {
      if (!existing) warning = `Saved the link, but couldn't read the report: ${e.message}`;
      else if (body.keep) warning = `Kept, but couldn't read the full report right now: ${e.message}`;
      else return json({ error: `Couldn't refresh the report: ${e.message}` }, 502);
    }
  } else {
    warning = 'Saved the link. Add the Warcraft Logs keys to the site to get the full breakdown (see README).';
  }

  const row = {
    url: `https://${parsed.host}/reports/${parsed.code}`,
    ...(summary && {
      title: summary.title,
      zone: summary.zone,
      started_at: summary.start ? new Date(summary.start).toISOString() : null,
      ended_at: summary.end ? new Date(summary.end).toISOString() : null,
      data: summary,
    }),
    ...(body.eventId ? { event_id: Number(body.eventId) } : {}),
    ...(body.keep ? { kept: true } : {}),
    updated_at: new Date().toISOString(),
  };

  const result = existing
    ? await supabase.from('logs').update(row).eq('id', existing.id).select('id').single()
    : await supabase.from('logs').insert({ code: parsed.code, ...row }).select('id').single();
  if (result.error) return json({ error: result.error.message }, 500);
  return json({ ok: true, id: result.data.id, updated: !!existing, warning });
}
