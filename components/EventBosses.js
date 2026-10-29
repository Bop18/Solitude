'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// "Bosses killed" on an event page.
// Shows kills the addon recorded around the event's time automatically,
// and lets people tick bosses by hand on nights nobody had the companion running.
export default function EventBosses({ event, signups, userId }) {
  const [bosses, setBosses] = useState([]);
  const [kills, setKills] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const start = new Date(event.starts_at);
  const windowFrom = new Date(start.getTime() - 60 * 60 * 1000).toISOString();
  const windowTo = new Date(start.getTime() + 8 * 60 * 60 * 1000).toISOString();

  const load = useCallback(async () => {
    const [b, k] = await Promise.all([
      supabase.from('dungeon_bosses').select('*').eq('dungeon_id', event.dungeon_id),
      supabase.from('boss_kills').select('*').eq('dungeon_id', event.dungeon_id).gte('killed_at', windowFrom).lte('killed_at', windowTo),
    ]);
    if (b.error || k.error) return setError('Boss tracking needs the latest database update (schema-6-progress.sql).');
    setBosses((b.data ?? []).sort((x, y) => (x.avg_ilvl ?? 0) - (y.avg_ilvl ?? 0)).map((r) => r.boss));
    setKills(k.data ?? []);
  }, [event.dungeon_id, windowFrom, windowTo]);

  useEffect(() => { load(); }, [load]);

  const killOf = (boss) => kills.find((k) => k.boss.toLowerCase() === boss.toLowerCase());
  const killedCount = bosses.filter((b) => killOf(b)).length;

  async function toggle(boss) {
    setBusy(true);
    setError('');
    const existing = killOf(boss);
    if (existing) {
      if (existing.source !== 'manual' || existing.uploaded_by !== userId) {
        setBusy(false);
        return setError(existing.source === 'addon' ? 'That kill was recorded by the addon, so it can’t be unticked here.' : 'Only the person who ticked it can untick it.');
      }
      const { error } = await supabase.from('boss_kills').delete().eq('id', existing.id);
      if (error) setError(error.message);
    } else {
      const going = signups.filter((s) => s.status === 'going');
      const killedAt = new Date(Math.min(Date.now(), start.getTime() + 60 * 1000)).toISOString();
      const { error } = await supabase.from('boss_kills').insert({
        boss,
        dungeon_id: event.dungeon_id,
        instance: event.dungeons?.name ?? null,
        event_id: event.id,
        killed_at: killedAt,
        source: 'manual',
        character_ids: going.map((s) => s.character_id).filter(Boolean),
        member_names: going.map((s) => s.characters?.name ?? s.profiles?.display_name).filter(Boolean),
      });
      if (error) setError(error.message);
    }
    setBusy(false);
    load();
  }

  if (!bosses.length && !error) return null;

  return (
    <section className="panel">
      <div className="row spread">
        <h2>Bosses killed</h2>
        <span className={`raid-count ${killedCount === bosses.length && bosses.length ? 'done' : ''}`}>{killedCount}/{bosses.length}</span>
      </div>
      <p className="muted small">
        Filled in automatically if someone in the group runs the Solitude companion. Otherwise, tick them off here after the run.
      </p>
      {error && <p className="error small">{error}</p>}
      <div className="boss-check">
        {bosses.map((b) => {
          const k = killOf(b);
          return (
            <label key={b} className={k ? 'on' : ''} title={k ? `${k.source === 'addon' ? 'Recorded by the addon' : 'Ticked by hand'}, ${new Date(k.killed_at).toLocaleTimeString()}` : 'Not killed'}>
              <input type="checkbox" checked={!!k} disabled={busy} onChange={() => toggle(b)} />
              {b}{k?.source === 'addon' ? ' ⚡' : ''}
            </label>
          );
        })}
      </div>
    </section>
  );
}
