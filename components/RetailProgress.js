'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthProvider';
import { classColor } from '@/lib/wow';

const SHORT = { LFR: 'LFR', NORMAL: 'N', HEROIC: 'H', MYTHIC: 'M' };
const mins = (ms) => `${Math.floor(ms / 60000)}:${String(Math.round((ms % 60000) / 1000)).padStart(2, '0')}`;
const rgb = (c) => (c ? `rgb(${c.r}, ${c.g}, ${c.b})` : undefined);

/** Best raid progress of the current raid, e.g. "6/8 H" */
function raidSummary(p) {
  const raid = p?.raids?.[p.raids.length - 1];
  if (!raid) return null;
  const order = ['MYTHIC', 'HEROIC', 'NORMAL', 'LFR'];
  const mode = [...raid.modes].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type)).find((m) => m.done > 0);
  return mode ? { raid: raid.name, text: `${mode.done}/${mode.total} ${SHORT[mode.type] ?? mode.difficulty}` } : null;
}

// Progress page → Retail: each retail character's M+ week, rating and raid progress from Blizzard.
export default function RetailProgress() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [chars, setChars] = useState(null);
  const [data, setData] = useState({}); // id → progress | { error }
  const [picked, setPicked] = useState(null);

  useEffect(() => {
    supabase.from('characters').select('*, profiles(display_name)').then(({ data: rows }) => {
      const retail = (rows ?? []).filter((c) => c.game === 'retail');
      setChars(retail);
      const mine = retail.find((c) => c.owner === userId);
      setPicked((p) => p ?? (mine ?? retail[0])?.id ?? null);
    });
  }, [userId]);

  async function load(c, fresh = false) {
    setData((d) => ({ ...d, [c.id]: { ...(d[c.id] ?? {}), loading: true } }));
    const { data: s } = await supabase.auth.getSession();
    const res = await fetch('/api/retail-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token ?? ''}` },
      body: JSON.stringify({ characterId: c.id, fresh }),
    });
    const body = await res.json().catch(() => ({}));
    setData((d) => ({ ...d, [c.id]: res.ok ? body : { error: body.error ?? `Failed (${res.status})` } }));
  }

  useEffect(() => { (chars ?? []).forEach((c) => load(c)); }, [chars]); // eslint-disable-line react-hooks/exhaustive-deps

  if (chars === null) return <p className="muted">Loading…</p>;
  if (chars.length === 0) {
    return (
      <section className="panel">
        <p className="muted">No retail characters yet. On the <Link href="/roster">Roster</Link>, add a character with <strong>Game: Retail</strong> and its realm.</p>
      </section>
    );
  }

  const sorted = [...chars].sort((a, b) => (data[b.id]?.rating ?? -1) - (data[a.id]?.rating ?? -1));
  const sel = chars.find((c) => c.id === picked);
  const p = sel && data[sel.id];

  return (
    <>
      <section className="panel">
        <h2>Retail characters</h2>
        <div className="table-wrap">
          <table className="retail-table">
            <thead><tr><th>Character</th><th>Item level</th><th>M+ rating</th><th>M+ this week</th><th>Raid</th></tr></thead>
            <tbody>
              {sorted.map((c) => {
                const d = data[c.id];
                const raid = raidSummary(d);
                return (
                  <tr key={c.id} className={`clickable ${picked === c.id ? 'picked' : ''}`} onClick={() => setPicked(c.id)}>
                    <td>
                      <strong style={{ color: classColor(c.class) }}>{c.name}</strong>
                      {c.owner === userId && <span className="badge gold" style={{ marginLeft: 6 }}>You</span>}
                      <div className="muted small">{c.profiles?.display_name} · {c.realm}</div>
                    </td>
                    {d?.error ? <td colSpan={4} className="muted small">{d.error}</td> : !d || d.loading && !d.name ? <td colSpan={4} className="muted small">Loading from Blizzard…</td> : (
                      <>
                        <td>{d.ilvl ?? '—'}</td>
                        <td><strong style={{ color: rgb(d.ratingColor) }}>{d.rating != null ? Math.round(d.rating) : '—'}</strong></td>
                        <td>{d.weekRuns.length ? <>{d.weekRuns.length} <span className="muted small">· best +{d.weekRuns[0].level}</span></> : <span className="muted">0</span>}</td>
                        <td>{raid ? <>{raid.text} <span className="muted small">{raid.raid}</span></> : <span className="muted">—</span>}</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {sel && (
        <section className="panel">
          <div className="row spread">
            <h2 style={{ color: classColor(sel.class) }}>{sel.name}{p?.spec ? <span className="muted small"> · {p.spec} {p.class}</span> : null}</h2>
            <div className="row">
              <Link className="btn ghost small" href="/logs">Logs</Link>
              <button className="btn ghost small" onClick={() => load(sel, true)} disabled={p?.loading}>{p?.loading ? 'Refreshing…' : 'Refresh'}</button>
            </div>
          </div>
          {!p || (p.loading && !p.name) ? <p className="muted">Loading from Blizzard…</p> : p.error ? <p className="error">{p.error}</p> : (
            <>
              <div className="stat-tiles">
                <div className="stat-tile"><span className="stat-num" style={{ color: rgb(p.ratingColor) }}>{p.rating != null ? Math.round(p.rating) : '—'}</span><span className="stat-label">M+ rating</span></div>
                <div className="stat-tile"><span className="stat-num">{p.weekRuns.length}</span><span className="stat-label">dungeons this week</span></div>
                <div className="stat-tile"><span className="stat-num">{p.raids.reduce((s, r) => s + r.modes.reduce((t, m) => t + m.thisWeek, 0), 0)}</span><span className="stat-label">raid bosses this week</span></div>
                <div className="stat-tile"><span className="stat-num">{p.ilvl ?? '—'}</span><span className="stat-label">item level</span></div>
              </div>

              <h3>Dungeons this week</h3>
              {p.weekRuns.length === 0 ? <p className="muted">No Mythic+ runs since the weekly reset.</p> : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Dungeon</th><th>Key</th><th>Result</th><th>Time</th><th>When</th></tr></thead>
                    <tbody>
                      {p.weekRuns.map((r, i) => (
                        <tr key={i}>
                          <td><strong>{r.dungeon}</strong></td>
                          <td>+{r.level}</td>
                          <td>{r.timed ? <span className="badge ok-badge">✓ Timed</span> : <span className="badge">Over time</span>}</td>
                          <td className="muted">{r.duration ? mins(r.duration) : '—'}</td>
                          <td className="muted small">{r.at ? new Date(r.at).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="muted small">Blizzard lists your best run in each dungeon this week.</p>

              <h3>Raids{p.expansion ? ` · ${p.expansion}` : ''}</h3>
              {p.raids.length === 0 ? <p className="muted">No raid kills in this expansion yet.</p> : p.raids.slice().reverse().map((raid) => (
                <div key={raid.name} className="retail-raid">
                  <strong>{raid.name}</strong>
                  <div className="retail-modes">
                    {raid.modes.map((m) => (
                      <div key={m.difficulty} className="retail-mode">
                        <div className="row spread">
                          <span>{m.difficulty}</span>
                          <span className="muted small">{m.done}/{m.total}{m.thisWeek ? ` · ${m.thisWeek} this week` : ''}</span>
                        </div>
                        <div className="meter-bar"><span style={{ width: `${m.total ? (m.done / m.total) * 100 : 0}%`, background: 'var(--accent)' }} /></div>
                        <ul className="boss-ticks">
                          {m.encounters.map((e) => (
                            <li key={e.name} className={e.thisWeek ? 'week' : e.kills ? 'done' : ''} title={e.lastKill ? `Last kill ${new Date(e.lastKill).toLocaleDateString()}` : 'Not killed yet'}>
                              {e.thisWeek ? '✓' : e.kills ? '•' : '○'} {e.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <p className="muted small">✓ = killed this week · • = killed before · Blizzard updates this when you log out.</p>
            </>
          )}
        </section>
      )}
    </>
  );
}
