'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { DAYS, SLOTS } from '@/lib/wow';

const key = (day, slot) => `${day}-${slot}`;

export default function AvailabilityPage() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [rows, setRows] = useState([]);
  const [members, setMembers] = useState({});
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [{ data: avail, error: e1 }, { data: profiles, error: e2 }] = await Promise.all([
      supabase.from('availability').select('*'),
      supabase.from('profiles').select('id, display_name'),
    ]);
    if (e1 || e2) return setError((e1 || e2).message);
    setRows(avail);
    setMembers(Object.fromEntries(profiles.map((p) => [p.id, p.display_name])));
  }, []);

  useEffect(() => { load(); }, [load]);

  const mySlots = new Set(rows.filter((r) => r.user_id === userId).map((r) => key(r.day, r.slot)));
  const totalMembers = Object.keys(members).length || 1;

  // Who is free in each slot
  const freeBySlot = {};
  for (const r of rows) {
    const k = key(r.day, r.slot);
    (freeBySlot[k] ??= []).push(members[r.user_id] ?? 'Unknown');
  }

  async function toggle(day, slot) {
    const k = key(day, slot);
    // Optimistic update so clicking feels instant
    if (mySlots.has(k)) {
      setRows(rows.filter((r) => !(r.user_id === userId && r.day === day && r.slot === slot)));
      const { error } = await supabase.from('availability').delete().match({ user_id: userId, day, slot });
      if (error) setError(error.message);
    } else {
      setRows([...rows, { user_id: userId, day, slot }]);
      const { error } = await supabase.from('availability').insert({ day, slot });
      if (error) setError(error.message);
    }
    load();
  }

  // Best times: slots with the most people free
  const best = Object.entries(freeBySlot)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3);

  return (
    <>
      <h1>Availability</h1>
      <p className="muted">Tick the times you can usually play each week. The group view shows when the most people overlap.</p>
      {error && <p className="error">{error}</p>}

      <div className="grid-2">
        <section className="panel">
          <h2>When I&apos;m free</h2>
          <div className="table-wrap">
            <table className="avail">
              <thead>
                <tr><th></th>{DAYS.map((d) => <th key={d}>{d}</th>)}</tr>
              </thead>
              <tbody>
                {Object.entries(SLOTS).map(([slot, label]) => (
                  <tr key={slot}>
                    <td className="slot-label">{label}</td>
                    {DAYS.map((d, day) => (
                      <td key={d}>
                        <button
                          className={mySlots.has(key(day, slot)) ? 'on' : ''}
                          onClick={() => toggle(day, slot)}
                          aria-pressed={mySlots.has(key(day, slot))}
                          aria-label={`${d} ${label}`}
                        >
                          {mySlots.has(key(day, slot)) ? '✓' : ''}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <h2>Whole group</h2>
          <div className="table-wrap">
            <table className="avail">
              <thead>
                <tr><th></th>{DAYS.map((d) => <th key={d}>{d}</th>)}</tr>
              </thead>
              <tbody>
                {Object.entries(SLOTS).map(([slot, label]) => (
                  <tr key={slot}>
                    <td className="slot-label">{label}</td>
                    {DAYS.map((d, day) => {
                      const names = freeBySlot[key(day, slot)] ?? [];
                      const strength = names.length / totalMembers;
                      return (
                        <td key={d}>
                          <div
                            className="heat"
                            title={names.length ? names.join(', ') : 'Nobody yet'}
                            style={{ background: `rgba(224, 180, 76, ${0.08 + strength * 0.8})`, color: strength > 0.5 ? '#1a1408' : 'var(--text)' }}
                          >
                            {names.length || ''}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">Hover a square to see who&apos;s free.</p>
        </section>
      </div>

      {best.length > 0 && (
        <section className="panel">
          <h2>Best times to play</h2>
          <div className="stack">
            {best.map(([k, names]) => {
              const [day, slot] = k.split('-');
              return (
                <div key={k} className="row spread">
                  <strong>{DAYS[day]} · {SLOTS[slot]}</strong>
                  <span className="muted">{names.length} free: {names.join(', ')}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
