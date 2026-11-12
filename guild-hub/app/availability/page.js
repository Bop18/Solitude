'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { DAYS, ROLES } from '@/lib/wow';
import { HOURS, hourLabel, groupReady, bestBlocks, nextDate, toLocalInput } from '@/lib/availability';

const key = (day, hour) => `${day}-${hour}`;

export default function AvailabilityPage() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [rows, setRows] = useState([]);         // everyone's hours
  const [members, setMembers] = useState({});   // userId → { name, role }
  const [mine, setMine] = useState(new Set());  // my hours, as "day-hour"
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [hover, setHover] = useState(null);     // "day-hour" in the group grid
  const drag = useRef(null);                    // { adding, start: Set, touched: Set }
  const [, force] = useState(0);

  const load = useCallback(async () => {
    const [{ data: hours, error: e1 }, { data: profiles, error: e2 }, { data: chars, error: e3 }] = await Promise.all([
      supabase.from('availability_hours').select('*'),
      supabase.from('profiles').select('id, display_name'),
      supabase.from('characters').select('*'),
    ]);
    const err = e1 || e2 || e3;
    if (err) {
      return setError(err.message.includes('availability_hours')
        ? 'This page needs the latest database update: run supabase/schema-7-availability.sql in Supabase.'
        : err.message);
    }
    // Each player's role = their main character's role (or their highest level character's)
    const roleOf = {};
    for (const c of [...chars].filter((x) => x.game !== 'retail').sort((a, b) => (b.is_main - a.is_main) || (b.level - a.level))) {
      if (!(c.owner in roleOf)) roleOf[c.owner] = c.role;
    }
    setMembers(Object.fromEntries(profiles.map((p) => [p.id, { name: p.display_name, role: roleOf[p.id] ?? null }])));
    setRows(hours);
    setMine(new Set(hours.filter((r) => r.user_id === userId).map((r) => key(r.day, r.hour))));
  }, [userId]);

  useEffect(() => { if (userId) load(); }, [load, userId]);

  // ---------- Painting your hours (click, or click and drag) ----------
  function cellAt(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-cell]');
    return el?.dataset.cell ?? null;
  }
  function paint(cell) {
    const d = drag.current;
    if (!d || !cell || d.touched.has(cell)) return;
    d.touched.add(cell);
    setMine((prev) => {
      const next = new Set(prev);
      if (d.adding) next.add(cell); else next.delete(cell);
      return next;
    });
  }
  function onPointerDown(e) {
    const cell = cellAt(e);
    if (!cell) return;
    e.preventDefault();
    drag.current = { adding: !mine.has(cell), start: new Set(mine), touched: new Set() };
    paint(cell);
    force((n) => n + 1);
  }
  function onPointerMove(e) {
    if (drag.current) paint(cellAt(e));
  }
  async function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    force((n) => n + 1);
    await save(d.start, mine);
  }
  useEffect(() => {
    const up = () => drag.current && onPointerUp();
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  });

  async function save(before, after) {
    const added = [...after].filter((c) => !before.has(c));
    const removed = [...before].filter((c) => !after.has(c));
    if (!added.length && !removed.length) return;
    setSaving(true);
    setError('');
    try {
      if (added.length) {
        const { error } = await supabase
          .from('availability_hours')
          .insert(added.map((c) => { const [day, hour] = c.split('-').map(Number); return { day, hour }; }));
        if (error) throw error;
      }
      const byDay = {};
      for (const c of removed) { const [day, hour] = c.split('-').map(Number); (byDay[day] ??= []).push(hour); }
      for (const [day, hours] of Object.entries(byDay)) {
        const { error } = await supabase.from('availability_hours').delete().eq('user_id', userId).eq('day', Number(day)).in('hour', hours);
        if (error) throw error;
      }
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
    load();
  }

  async function quickFill(kind) {
    const before = new Set(mine);
    const after = kind === 'clear' ? new Set() : new Set(before);
    if (kind === 'weeknights') for (let d = 0; d < 5; d++) for (const h of [19, 20, 21, 22]) after.add(key(d, h));
    if (kind === 'weekends') for (const d of [5, 6]) for (const h of HOURS.filter((x) => x <= 23)) after.add(key(d, h));
    setMine(after);
    await save(before, after);
  }

  // ---------- Group view ----------
  const free = {};
  for (const r of rows) {
    const m = members[r.user_id];
    if (m) (free[key(r.day, r.hour)] ??= []).push(m);
  }
  const memberCount = Object.keys(members).length || 1;
  const filledIn = new Set(rows.map((r) => r.user_id));
  const notFilled = Object.entries(members).filter(([id]) => !filledIn.has(id)).map(([, m]) => m.name);
  const blocks = bestBlocks(free, { minPlayers: Math.min(3, memberCount) });
  const hoverPlayers = hover ? free[hover] ?? [] : [];

  const renderGrid = (editable) => (
    <div
      className={`hours-grid ${editable ? 'editable' : ''}`}
      onPointerDown={editable ? onPointerDown : undefined}
      onPointerMove={editable ? onPointerMove : undefined}
      onPointerLeave={editable ? undefined : () => setHover(null)}
    >
      <div className="hg-corner" />
      {DAYS.map((d) => <div key={d} className="hg-day">{d}</div>)}
      {HOURS.map((h) => (
        <div key={h} className="hg-row">
          <div className="hg-hour">{hourLabel(h)}</div>
          {DAYS.map((_, day) => {
            const k = key(day, h);
            if (editable) {
              return <div key={k} data-cell={k} className={`hg-cell ${mine.has(k) ? 'on' : ''}`} aria-label={`${DAYS[day]} ${hourLabel(h)}`} />;
            }
            const players = free[k] ?? [];
            const strength = players.length / memberCount;
            const ready = groupReady(players);
            return (
              <div
                key={k}
                className={`hg-cell heat ${hover === k ? 'hovered' : ''}`}
                onPointerEnter={() => setHover(k)}
                style={{
                  background: players.length ? `color-mix(in srgb, var(--accent) ${Math.round(12 + strength * 78)}%, var(--bg-sunken))` : undefined,
                  color: strength > 0.5 ? 'var(--on-accent)' : 'var(--text)',
                }}
              >
                {players.length || ''}{ready && <span className="ready-dot" title="Tank + healer + 5 people" />}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );

  return (
    <>
      <h1>Availability</h1>
      <p className="muted">Paint the hours you can usually play each week. The group view shows when the most people overlap, and when you&apos;d have a full group.</p>
      {error && <p className="error">{error}</p>}

      {/* ---------- Best times ---------- */}
      <section className="panel">
        <h2>Best times this week</h2>
        {blocks.length === 0 ? (
          <p className="muted">Not enough overlap yet. Once a few people have filled in their hours, the best times show up here.</p>
        ) : (
          <div className="best-blocks">
            {blocks.map((b) => {
              const when = nextDate(b.day, b.from);
              return (
                <div key={`${b.day}-${b.from}`} className="best-block">
                  <div className="row spread">
                    <strong>{DAYS[b.day]} {hourLabel(b.from)}–{hourLabel(b.to)}</strong>
                    {b.ready ? <span className="badge ok-badge">✓ Group ready</span> : <span className="badge" title="For a 5-player dungeon">Needs {b.missing.join(' + ')}</span>}
                  </div>
                  <div className="muted small">
                    {b.min}+ free the whole time · {when.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                  </div>
                  <div className="small" style={{ margin: '0.35rem 0 0.6rem' }}>{b.names.join(', ')}</div>
                  <Link className="btn small" href={`/events?when=${encodeURIComponent(toLocalInput(when))}`}>Plan a run</Link>
                </div>
              );
            })}
          </div>
        )}
        {notFilled.length > 0 && (
          <p className="muted small" style={{ marginTop: '0.9rem', marginBottom: 0 }}>Haven&apos;t filled theirs in yet: {notFilled.join(', ')}</p>
        )}
      </section>

      <div className="grid-2">
        {/* ---------- My hours ---------- */}
        <section className="panel">
          <div className="row spread">
            <h2>When I&apos;m free</h2>
            <span className="muted small">{saving ? 'Saving…' : `${mine.size} hour${mine.size === 1 ? '' : 's'} a week`}</span>
          </div>
          <p className="muted small">Click or click-and-drag to paint hours. Drag over painted ones to clear them.</p>
          <div className="row" style={{ marginBottom: '0.75rem' }}>
            <button className="btn ghost small" onClick={() => quickFill('weeknights')}>+ Weeknights 7–11pm</button>
            <button className="btn ghost small" onClick={() => quickFill('weekends')}>+ Weekend afternoons & evenings</button>
            <button className="btn ghost small" onClick={() => quickFill('clear')}>Clear all</button>
          </div>
          {renderGrid(true)}
        </section>

        {/* ---------- Whole group ---------- */}
        <section className="panel">
          <h2>Whole group</h2>
          <p className="muted small">Number = people free. <span className="ready-dot inline" /> = enough for a dungeon (tank, healer, 5 people). Hover for names.</p>
          {renderGrid(false)}
          <div className="hover-info">
            {hover ? (
              hoverPlayers.length ? (
                <>
                  <strong>{DAYS[Number(hover.split('-')[0])]} {hourLabel(Number(hover.split('-')[1]))}</strong>:{' '}
                  {hoverPlayers.map((p) => `${p.role ? ROLES[p.role].icon + ' ' : ''}${p.name}`).join(', ')}
                </>
              ) : <span className="muted">Nobody free</span>
            ) : <span className="muted">Hover a square to see who&apos;s free.</span>}
          </div>
        </section>
      </div>
    </>
  );
}
