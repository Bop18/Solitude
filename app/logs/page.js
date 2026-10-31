'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { clock, short } from '@/lib/wcl';
import { classColor } from '@/lib/wow';

export default function LogsPage() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [view, setView] = useState('all'); // all | mine
  const [myChars, setMyChars] = useState([]);
  const [picked, setPicked] = useState('all'); // 'all' or a character id
  const [finding, setFinding] = useState(false);
  const [findNote, setFindNote] = useState('');
  const [logs, setLogs] = useState([]);
  const [events, setEvents] = useState([]);
  const [url, setUrl] = useState('');
  const [eventId, setEventId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 14 * 86400e3).toISOString();
    const cols = 'id, code, url, title, zone, started_at, data, event_id, events(id, title), profiles!added_by(display_name)';
    const query = (c) => supabase.from('logs').select(c).order('started_at', { ascending: false, nullsFirst: false }).limit(400);
    const [l0, e] = await Promise.all([
      query(`${cols}, found_for`),
      supabase.from('events').select('id, title, starts_at').gte('starts_at', since).lte('starts_at', new Date().toISOString()).order('starts_at', { ascending: false }).limit(20),
    ]);
    const l = l0.error?.message?.includes('found_for') ? await query(cols) : l0; // before update 14
    if (l.error) setError(l.error.message.includes('logs') ? 'Run supabase/schema-13-logs.sql in Supabase to turn on Logs.' : l.error.message);
    setLogs(l.data ?? []);
    setEvents(e.data ?? []);
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!userId) return;
    supabase.from('characters').select('id, name, class, realm, is_main, level').eq('owner', userId)
      .then(({ data }) => setMyChars((data ?? []).sort((a, b) => (b.is_main - a.is_main) || (b.level - a.level))));
  }, [userId]);

  async function authHeaders() {
    const { data } = await supabase.auth.getSession();
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` };
  }

  // Ask Warcraft Logs for this character's reports (or all of mine) and save any new ones.
  // Runs by itself when you open My logs / pick a character, at most every 30 minutes.
  const check = useCallback(async (which, { force = false } = {}) => {
    const key = `wcl-checked-${which}`;
    let last = 0;
    try { last = Number(sessionStorage.getItem(key) ?? 0); } catch { /* ignore */ }
    if (!force && Date.now() - last < 30 * 60e3) return;
    try { sessionStorage.setItem(key, String(Date.now())); } catch { /* ignore */ }
    setFinding(true); setFindNote('');
    try {
      const res = await fetch('/api/logs/find', {
        method: 'POST', headers: await authHeaders(),
        body: JSON.stringify(which === 'all' ? {} : { characterId: which }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Failed (${res.status})`);
      const parts = [];
      parts.push(body.added ? `Found ${body.added} new log${body.added === 1 ? '' : 's'} on Warcraft Logs.` : 'No new logs.');
      if (body.details?.length) parts.push(...body.details);
      if (body.note) parts.push(body.note);
      setFindNote(parts.join(' '));
      if (body.added) await load();
    } catch (err) {
      setFindNote(err.message);
    }
    setFinding(false);
  }, [load]);

  useEffect(() => {
    if (view === 'mine' && myChars.length) check(picked);
  }, [view, picked, myChars.length, check]);

  const charsShown = picked === 'all' ? myChars : myChars.filter((c) => String(c.id) === String(picked));
  const has = (l, c) => (l.found_for ?? []).includes(c.id) || (l.data?.players ?? []).some((p) => p.name.toLowerCase() === c.name.toLowerCase());
  const shownLogs = view === 'mine' ? logs.filter((l) => charsShown.some((c) => has(l, c))) : logs;

  async function add(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
        body: JSON.stringify({ url, eventId: eventId || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Failed (${res.status})`);
      router.push(`/logs/${body.id}${body.warning ? `?note=${encodeURIComponent(body.warning)}` : ''}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Logs</h1>
      <section className="panel">
        <h2>Add a Warcraft Logs report</h2>
        <p className="muted small">
          Paste the link to a report. The site reads it, shows it in a simpler way, and keeps a copy here for good.
        </p>
        <form onSubmit={add} className="row" style={{ alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 320px' }}>
            <label htmlFor="wcl">Report link</label>
            <input id="wcl" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://classic.warcraftlogs.com/reports/…" />
          </div>
          {events.length > 0 && (
            <div>
              <label htmlFor="ev">Which run? (optional)</label>
              <select id="ev" value={eventId} onChange={(e) => setEventId(e.target.value)}>
                <option value="">—</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.title} · {new Date(ev.starts_at).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</option>
                ))}
              </select>
            </div>
          )}
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Reading the log…' : 'Add log'}</button>
        </form>
        {error && <p className="error">{error}</p>}
      </section>

      <nav className="tabs">
        <a href="#" className={view === 'all' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setView('all'); }}>All logs</a>
        <a href="#" className={view === 'mine' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setView('mine'); }}>My logs</a>
      </nav>

      {view === 'mine' && (
        <section className="panel">
          <div className="row spread">
            <h2>Your characters</h2>
            <button className="btn ghost small" onClick={() => check(picked, { force: true })} disabled={finding || !myChars.length}>
              {finding ? 'Checking Warcraft Logs…' : 'Check again'}
            </button>
          </div>
          {myChars.length === 0 ? (
            <p className="muted">Add your characters on the <Link href="/roster">Roster</Link> (with their realm or ruleset) and their logs appear here by themselves.</p>
          ) : (
            <div className="fight-chips">
              <button className={`fight-chip ${picked === 'all' ? 'on' : ''}`} onClick={() => setPicked('all')}>
                All my characters <span className="muted small">{logs.filter((l) => myChars.some((c) => has(l, c))).length} logs</span>
              </button>
              {myChars.map((c) => (
                <button key={c.id} className={`fight-chip ${String(picked) === String(c.id) ? 'on' : ''}`} onClick={() => setPicked(c.id)}>
                  <span style={{ color: classColor(c.class) }}>{c.name}</span>
                  <span className="muted small">{c.realm ?? 'no realm set'} · {logs.filter((l) => has(l, c)).length} logs</span>
                </button>
              ))}
            </div>
          )}
          <p className="muted small" style={{ marginBottom: 0 }}>
            {finding ? 'Looking for new logs on Warcraft Logs…' : findNote || 'Logs your characters are in are picked up from Warcraft Logs automatically.'}
          </p>
        </section>
      )}

      <section className="panel">
        <h2>{view === 'mine' ? (picked === 'all' ? 'Your logs' : `${charsShown[0]?.name ?? ''}'s logs`) : 'Saved logs'}</h2>
        {!loaded ? <p className="muted">Loading…</p> : shownLogs.length === 0 ? (
          <p className="muted">{view === 'mine'
            ? (finding ? 'Checking Warcraft Logs…' : 'No logs found for this character yet. Reports only show up once they are uploaded to Warcraft Logs as public or unlisted.')
            : 'No logs yet. After a run, upload it with the Warcraft Logs uploader and paste the link above.'}</p>
        ) : (
          <div className="log-list">
            {shownLogs.map((l) => {
              // Top DPS of the whole log
              const topRow = l.data?.overall?.damage?.[0];
              const topPlayer = topRow && (l.data.players ?? []).find((p) => p.id === topRow.id);
              const topDps = topRow && l.data.overall.time ? (topRow.total / l.data.overall.time) * 1000 : null;
              return (
                <Link key={l.id} href={`/logs/${l.id}`} className="log-row">
                  <div style={{ minWidth: 0 }}>
                    <div className="log-title">{l.title || l.zone || `Report ${l.code}`}</div>
                    <div className="muted small">
                      {[l.zone && l.zone !== l.title && l.zone,
                        l.started_at && new Date(l.started_at).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
                        l.data && `${clock((l.data.end ?? 0) - (l.data.start ?? 0))} long`,
                        l.events?.title && `Run: ${l.events.title}`,
                        l.profiles?.display_name && `added by ${l.profiles.display_name}`,
                      ].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="row" style={{ flexWrap: 'nowrap' }}>
                    {l.data ? (
                      <>
                        {topPlayer && (
                          <span className="top-dps" title="Most damage per second over the whole log">
                            <span className="muted small">Top DPS</span>
                            <strong style={{ color: classColor(topPlayer.class) }}>{topPlayer.name}</strong>
                            {topDps != null && <span className="muted small">{short(topDps)}</span>}
                          </span>
                        )}
                      </>
                    ) : <span className="badge" title="The breakdown is read from Warcraft Logs when you open it">Open to read</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
