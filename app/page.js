'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import EventCard from '@/components/EventCard';
import LevelBar from '@/components/LevelBar';
import { MAX_LEVEL, classColor } from '@/lib/wow';

export default function Dashboard() {
  const { profile } = useAuth();
  const [events, setEvents] = useState([]);
  const [mains, setMains] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const [ev, ch] = await Promise.all([
        supabase
          .from('events')
          .select('*, event_signups(status)')
          .gte('starts_at', new Date().toISOString())
          .order('starts_at')
          .limit(5),
        supabase
          .from('characters')
          .select('*, profiles(display_name)')
          .order('level', { ascending: false }),
      ]);
      if (ev.error || ch.error) setError((ev.error || ch.error).message);
      setEvents(ev.data ?? []);
      // One character per player: their main, or their highest level
      const byPlayer = new Map();
      for (const c of ch.data ?? []) {
        const current = byPlayer.get(c.owner);
        if (!current || (c.is_main && !current.is_main)) byPlayer.set(c.owner, c);
      }
      setMains([...byPlayer.values()].sort((a, b) => b.level - a.level));
    })();
  }, []);

  const capped = mains.filter((c) => c.level >= MAX_LEVEL).length;
  const avg = mains.length ? Math.round(mains.reduce((sum, c) => sum + c.level, 0) / mains.length) : 0;

  return (
    <>
      <h1>Welcome back{profile?.display_name ? `, ${profile.display_name}` : ''}</h1>
      {error && <p className="error">{error}</p>}

      <div className="grid-2">
        <section className="panel">
          <div className="row spread">
            <h2>Next runs</h2>
            <Link href="/events" className="small">Plan one →</Link>
          </div>
          {events.length === 0 ? (
            <p className="muted">Nothing scheduled. Check <Link href="/availability">availability</Link> and plan a run.</p>
          ) : (
            <div className="event-list">{events.map((ev) => <EventCard key={ev.id} event={ev} />)}</div>
          )}
        </section>

        <section className="panel">
          <div className="row spread">
            <h2>Levelling race</h2>
            <Link href="/roster" className="small">Full roster →</Link>
          </div>
          {mains.length === 0 ? (
            <p className="muted">No characters yet. <Link href="/roster">Add yours</Link>.</p>
          ) : (
            <>
              <p className="muted small">Average level {avg} · {capped} at max level</p>
              <div className="stack">
                {mains.map((c, i) => (
                  <div key={c.id} className="row" style={{ flexWrap: 'nowrap' }}>
                    <span className="muted" style={{ width: '1.5rem' }}>{i + 1}.</span>
                    <div style={{ width: '40%', minWidth: 0 }}>
                      <strong style={{ color: classColor(c.class) }}>{c.name}</strong>
                      <div className="muted small">{c.profiles?.display_name}</div>
                    </div>
                    <div style={{ flex: 1 }}><LevelBar level={c.level} className={c.class} /></div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
