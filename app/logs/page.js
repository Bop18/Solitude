'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { clock } from '@/lib/wcl';

export default function LogsPage() {
  const router = useRouter();
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

      <section className="panel">
        <h2>Saved logs</h2>
        {!loaded ? <p className="muted">Loading…</p> : logs.length === 0 ? (
          <p className="muted">No logs yet. After a run, upload it with the Warcraft Logs uploader and paste the link above.</p>
        ) : (
          <div className="log-list">
            {logs.map((l) => {
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
