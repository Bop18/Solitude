'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { clock } from '@/lib/wcl';

export default function LogsPage() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [view, setView] = useState('all'); // all | mine
  const [myNames, setMyNames] = useState([]);
  const [found, setFound] = useState(null); // reports found on Warcraft Logs
  const [finding, setFinding] = useState(false);
  const [findNote, setFindNote] = useState('');
  const [saving, setSaving] = useState({});
  const [logs, setLogs] = useState([]);
  const [events, setEvents] = useState([]);
  const [url, setUrl] = useState('');
  const [eventId, setEventId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 14 * 86400e3).toISOString();
    const [l, e] = await Promise.all([
      supabase.from('logs').select('id, code, url, title, zone, started_at, data, event_id, events(id, title), profiles!added_by(display_name)').order('started_at', { ascending: false, nullsFirst: false }).limit(100),
      supabase.from('events').select('id, title, starts_at').gte('starts_at', since).lte('starts_at', new Date().toISOString()).order('starts_at', { ascending: false }).limit(20),
    ]);
    if (l.error) setError(l.error.message.includes('logs') ? 'Run supabase/schema-13-logs.sql in Supabase to turn on Logs.' : l.error.message);
    setLogs(l.data ?? []);
    setEvents(e.data ?? []);
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!userId) return;
    supabase.from('characters').select('name').eq('owner', userId)
      .then(({ data }) => setMyNames((data ?? []).map((c) => c.name.toLowerCase())));
  }, [userId]);

  async function authHeaders() {
    const { data } = await supabase.auth.getSession();
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` };
  }

  // Ask Warcraft Logs for reports my characters are in
  async function findMine() {
    setFinding(true); setFindNote(''); setError('');
    try {
      const res = await fetch('/api/logs/find', { method: 'POST', headers: await authHeaders(), body: '{}' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Failed (${res.status})`);
      setFound(body.reports ?? []);
      const parts = [];
      if (body.searched?.length) parts.push(`Searched for ${body.searched.join(', ')}.`);
      if (body.notFound?.length) parts.push(`Not on Warcraft Logs yet: ${body.notFound.join(', ')}.`);
      if (body.note) parts.push(body.note);
      setFindNote(parts.join(' '));
    } catch (err) {
      setError(err.message);
    }
    setFinding(false);
  }

  async function saveFound(r) {
    setSaving((x) => ({ ...x, [r.code]: 'saving' }));
    const res = await fetch('/api/logs', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ url: r.url }) });
    const body = await res.json().catch(() => ({}));
    setSaving((x) => ({ ...x, [r.code]: res.ok ? body.id : 'error' }));
    if (res.ok) load();
  }

  const savedCodes = new Set(logs.map((l) => l.code));
  const isMine = (l) => (l.data?.players ?? []).some((p) => myNames.includes(p.name.toLowerCase()));
  const shownLogs = view === 'mine' ? logs.filter(isMine) : logs;

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
            <h2>On Warcraft Logs</h2>
            <button className="btn small" onClick={findMine} disabled={finding}>{finding ? 'Searching…' : found ? 'Search again' : 'Find my logs'}</button>
          </div>
          <p className="muted small">Looks up every report your characters appear in, even ones nobody has added here yet. Save the ones you want to keep.</p>
          {findNote && <p className="muted small">{findNote}</p>}
          {found && (found.length === 0 ? <p className="muted">No reports found for your characters.</p> : (
            <div className="log-list">
              {found.map((r) => {
                const state = saving[r.code];
                const saved = savedCodes.has(r.code) || typeof state === 'number';
                const savedId = typeof state === 'number' ? state : logs.find((l) => l.code === r.code)?.id;
                return (
                  <div key={r.code} className="log-row">
                    <div style={{ minWidth: 0 }}>
                      <div className="log-title">{r.title || r.zone || r.code}</div>
                      <div className="muted small">
                        {[r.zone && r.zone !== r.title && r.zone,
                          r.start && new Date(r.start).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
                          r.start && r.end && `${clock(r.end - r.start)} long`,
                          `with ${r.characters.join(', ')}`,
                        ].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div className="row" style={{ flexWrap: 'nowrap' }}>
                      <a className="btn ghost small" href={r.url} target="_blank" rel="noreferrer">↗</a>
                      {saved
                        ? <Link className="btn ghost small" href={`/logs/${savedId}`}>✓ Saved</Link>
                        : <button className="btn small" disabled={state === 'saving'} onClick={() => saveFound(r)}>{state === 'saving' ? 'Saving…' : state === 'error' ? 'Try again' : 'Save'}</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </section>
      )}

      <section className="panel">
        <h2>{view === 'mine' ? 'Saved logs you’re in' : 'Saved logs'}</h2>
        {!loaded ? <p className="muted">Loading…</p> : shownLogs.length === 0 ? (
          <p className="muted">{view === 'mine'
            ? 'None of the saved logs have your characters in them yet. Use Find my logs above.'
            : 'No logs yet. After a run, upload it with the Warcraft Logs uploader and paste the link above.'}</p>
        ) : (
          <div className="log-list">
            {shownLogs.map((l) => {
              const bosses = l.data?.bosses ?? [];
              const kills = bosses.filter((b) => b.kill).length;
              const wipes = bosses.length - kills;
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
                        {kills > 0 && <span className="badge ok-badge">{kills} kill{kills === 1 ? '' : 's'}</span>}
                        {wipes > 0 && <span className="badge">{wipes} wipe{wipes === 1 ? '' : 's'}</span>}
                      </>
                    ) : <span className="badge">Link only</span>}
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
