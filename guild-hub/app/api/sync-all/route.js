// /api/sync-all — keeps EVERYONE's WoW: Forever / Classic characters up to date from Battle.net.
//   POST (any logged-in member; the site calls it quietly when someone opens it)
//   GET  (Vercel Cron, once a day as a backup; see vercel.json)
// Only characters not checked in the last 20 minutes are looked at, oldest first, a batch at a time.
// Needs SUPABASE_SERVICE_ROLE_KEY (Supabase → Project Settings → API → service_role) so it can
// update other people's characters. Set CRON_SECRET too if you want the daily cron run.

import { createClient } from '@supabase/supabase-js';
import { syncCharacter } from '@/lib/bnetSync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const json = (body, status = 200) => Response.json(body, { status });
const STALE_MINUTES = 20;
const BATCH = 12;
let lastRun = 0; // per server instance: don't run more than once a minute

async function run() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Add SUPABASE_SERVICE_ROLE_KEY in Vercel to update everyone automatically.' }, 501);
  if (!process.env.BLIZZARD_CLIENT_ID || !process.env.BLIZZARD_CLIENT_SECRET) return json({ error: 'Battle.net keys missing.' }, 501);
  if (Date.now() - lastRun < 60_000) return json({ ok: true, skipped: 'ran a moment ago' });
  lastRun = Date.now();

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const cutoff = new Date(Date.now() - STALE_MINUTES * 60e3).toISOString();
  const { data: chars, error } = await admin.from('characters').select('*')
    .or('game.is.null,game.neq.retail')
    .or(`sync_checked_at.is.null,sync_checked_at.lt.${cutoff}`)
    .order('sync_checked_at', { ascending: true, nullsFirst: true })
    .limit(BATCH);
  if (error) return json({ error: /sync_checked_at/.test(error.message) ? 'Run supabase/schema-22-auto-sync.sql in Supabase first.' : error.message }, 500);

  const results = [];
  for (const c of chars ?? []) {
    // Mark it checked first, so characters Blizzard doesn't have yet don't block everyone else
    await admin.from('characters').update({ sync_checked_at: new Date().toISOString() }).eq('id', c.id);
    try {
      const { status, body } = await syncCharacter(admin, c, { quick: true });
      results.push({ name: c.name, ok: status === 200, level: body.level ?? null, gear: body.gearMissing ? 'none from Blizzard' : body.equipped ?? null, status });
      if (status === 501) break;
    } catch (e) {
      results.push({ name: c.name, ok: false, error: e.message });
    }
  }
  return json({ ok: true, checked: results.length, updated: results.filter((r) => r.ok).length, results });
}

export async function POST(request) {
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Please log in again.' }, 401);
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await anon.auth.getUser(token);
  if (!data?.user) return json({ error: 'Please log in again.' }, 401);
  return run();
}

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return json({ error: 'Not allowed.' }, 401);
  return run();
}
