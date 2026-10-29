'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthProvider';
import { EVENT_KINDS, classColor } from '@/lib/wow';
import { missing } from '@/lib/availability';
import { mainsByOwner } from '@/lib/suggest';

const WINDOW_HOURS = 14; // show a run that starts within this many hours (or started < 2h ago)

function countdown(ms) {
  if (ms <= 0) return 'Happening now';
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  if (h >= 1) return `in ${h}h ${String(m % 60).padStart(2, '0')}m`;
  const s = Math.floor((ms % 60000) / 1000);
  return `in ${m}m ${String(s).padStart(2, '0')}s`;
}

// Dashboard: the big banner when a run is on tonight, with a one-tap "I'm in".
export default function TonightBanner() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [event, setEvent] = useState(null);
  const [myMain, setMyMain] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const from = new Date(Date.now() - 2 * 3600e3).toISOString();
    const to = new Date(Date.now() + WINDOW_HOURS * 3600e3).toISOString();
    const [ev, mine] = await Promise.all([
      supabase
        .from('events')
        .select('*, dungeons!dungeon_id(name), event_signups(user_id, role, status, characters(name, class), profiles(display_name))')
        .gte('starts_at', from)
        .lte('starts_at', to)
        .order('starts_at')
        .limit(1),
      userId ? supabase.from('characters').select('id, name, class, role, level, is_main, owner').eq('owner', userId) : { data: [] },
    ]);
    setEvent(ev.data?.[0] ?? null);
    setMyMain(mainsByOwner(mine.data ?? [])[userId] ?? null);
  }

  useEffect(() => { load(); }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!event) return null;

  const starts = new Date(event.starts_at);
  const signups = event.event_signups ?? [];
  const going = signups.filter((s) => s.status === 'going');
  const mine = signups.find((s) => s.user_id === userId);
  const size = event.max_size ?? 5;
  const gaps = size <= 5
    ? missing(going.map((s) => ({ role: s.role })))
    : (going.length < size ? [`${size - going.length} more people`] : []);

  async function imIn(status = 'going') {
    setBusy(true);
    setError('');
    const { error } = await supabase.from('event_signups').upsert({
      event_id: event.id,
      user_id: userId,
      character_id: myMain?.id ?? null,
      role: myMain?.role ?? null,
      status,
    });
    if (error) setError(error.message);
    else window.dispatchEvent(new Event('solitude:signup'));
    await load();
    setBusy(false);
  }

  return (
    <section className="tonight">
      <div className="tonight-when">
        <span className="tonight-label">{starts.toDateString() === new Date().toDateString() ? 'Tonight' : 'Coming up'}</span>
        <span className="tonight-count">{countdown(starts.getTime() - now)}</span>
        <span className="muted small">{starts.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <div className="tonight-body">
        <Link href={`/events/${event.id}`} className="tonight-title">{event.title}</Link>
        <div className="muted small">
          {EVENT_KINDS[event.kind]?.label ?? event.kind}{event.dungeons?.name && event.dungeons.name !== event.title ? ` · ${event.dungeons.name}` : ''} · {going.length}/{size} going
        </div>
        <div className="tonight-people">
          {going.length === 0 && <span className="muted small">Nobody yet. Be the first.</span>}
          {going.map((s) => (
            <span key={s.user_id} className="chip" style={{ color: classColor(s.characters?.class) }}>
              {s.characters?.name ?? s.profiles?.display_name}{s.role ? <span className="muted"> · {s.role}</span> : null}
            </span>
          ))}
        </div>
        {gaps.length > 0
          ? <div className="tonight-gap">Still needs {gaps.join(', ')}</div>
          : <div className="tonight-ok">✓ Full group</div>}
        {error && <p className="error small">{error}</p>}
      </div>
      <div className="tonight-actions">
        {mine?.status === 'going' ? (
          <>
            <span className="badge ok-badge">✓ You&apos;re in{mine.characters?.name ? ` on ${mine.characters.name}` : ''}</span>
            <button className="btn ghost small" disabled={busy} onClick={() => imIn('not_going')}>Can&apos;t make it</button>
          </>
        ) : (
          <>
            <button className="btn" disabled={busy} onClick={() => imIn('going')}>
              I&apos;m in{myMain ? ` (${myMain.name})` : ''}
            </button>
            {mine?.status && <span className="muted small">You said {mine.status === 'maybe' ? 'maybe' : 'no'}</span>}
          </>
        )}
        <Link href={`/events/${event.id}`} className="small">Details →</Link>
      </div>
    </section>
  );
}
