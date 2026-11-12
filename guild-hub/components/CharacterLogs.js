'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { clock, short } from '@/lib/wcl';

// On a character page: every log this character is in, with how they did.
// Also checks Warcraft Logs for new ones (at most every 30 minutes per character).
export default function CharacterLogs({ character }) {
  const [logs, setLogs] = useState(null);
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('logs')
      .select('*')
      .order('started_at', { ascending: false, nullsFirst: false })
      .limit(400);
    if (error) return setLogs([]);
    const name = character.name.toLowerCase();
    setLogs((data ?? []).filter((l) =>
      (l.found_for ?? []).includes(character.id) || (l.data?.players ?? []).some((p) => p.name?.toLowerCase() === name)));
  }, [character.id, character.name]);

  const check = useCallback(async (force = false) => {
    const key = `wcl-checked-${character.id}`;
    let last = 0;
    try { last = Number(sessionStorage.getItem(key) ?? 0); } catch { /* ignore */ }
    if (!force && Date.now() - last < 30 * 60e3) return;
    try { sessionStorage.setItem(key, String(Date.now())); } catch { /* ignore */ }
    setChecking(true);
    const { data: s } = await supabase.auth.getSession();
    const res = await fetch('/api/logs/find', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token ?? ''}` },
      body: JSON.stringify({ characterId: character.id }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) setNote(res.status === 501 ? '' : body.error ?? '');
    else {
      setNote(body.added ? `Found ${body.added} new log${body.added === 1 ? '' : 's'} on Warcraft Logs.` : (body.details ?? []).join(' '));
      if (body.added) await load();
    }
    setChecking(false);
  }, [character.id, load]);

  useEffect(() => { load().then(() => check()); }, [load, check]);

  // Opened with #logs (from a "Logs" button)? Scroll down to here once the page has loaded
  useEffect(() => {
    if (window.location.hash === '#logs') setTimeout(() => document.getElementById('logs')?.scrollIntoView({ behavior: 'smooth' }), 150);
  }, []);

  // How this character did in a log
  function mine(l) {
    const p = (l.data?.players ?? []).find((x) => x.name?.toLowerCase() === character.name.toLowerCase());
    if (!p) return null;
    const time = l.data.overall?.time;
    const dmg = l.data.overall?.damage ?? [];
    const heal = l.data.overall?.healing ?? [];
    const di = dmg.findIndex((r) => r.id === p.id);
    const hi = heal.findIndex((r) => r.id === p.id);
    // Show whichever they're better at (healers: healing)
    const useHeal = hi >= 0 && (di < 0 || hi < di);
    const list = useHeal ? heal : dmg;
    const i = useHeal ? hi : di;
    if (i < 0 || !time) return null;
    return { kind: useHeal ? 'HPS' : 'DPS', per: (list[i].total / time) * 1000, rank: i + 1, of: list.length };
  }

  return (
    <section className="panel" id="logs" style={{ scrollMarginTop: 90 }}>
      <div className="row spread">
        <h2>Logs</h2>
        <button className="btn ghost small" onClick={() => check(true)} disabled={checking}>{checking ? 'Checking Warcraft Logs…' : 'Check Warcraft Logs'}</button>
      </div>
      {note && <p className="muted small" style={{ marginTop: 0 }}>{note}</p>}
      {logs === null ? <p className="muted">Loading…</p> : logs.length === 0 ? (
        <p className="muted">{checking ? 'Looking on Warcraft Logs…' : `No logs with ${character.name} yet.`}</p>
      ) : (
        <div className="log-list">
          {logs.slice(0, 30).map((l) => {
            const m = mine(l);
            return (
              <Link key={l.id} href={`/logs/${l.id}`} className="log-row">
                <div style={{ minWidth: 0 }}>
                  <div className="log-title">{l.kept ? '★ ' : ''}{l.title || l.zone || `Report ${l.code}`}</div>
                  <div className="muted small">
                    {[l.zone && l.zone !== l.title && l.zone,
                      l.started_at && new Date(l.started_at).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
                      l.data && `${clock((l.data.end ?? 0) - (l.data.start ?? 0))} long`,
                    ].filter(Boolean).join(' · ')}
                  </div>
                </div>
                {m ? (
                  <span className="top-dps" title={`${character.name}'s ${m.kind} over the whole log`}>
                    <strong>{short(m.per)}</strong><span className="muted small">{m.kind} · #{m.rank} of {m.of}</span>
                  </span>
                ) : <span className="badge">{l.data ? '—' : 'Open to read'}</span>}
              </Link>
            );
          })}
        </div>
      )}
      {logs?.length > 30 && <p className="muted small"><Link href="/logs">See all on the Logs page →</Link></p>}
    </section>
  );
}
