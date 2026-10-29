'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { formatWhen } from '@/components/EventCard';
import ItemName from '@/components/ItemName';
import EventBosses from '@/components/EventBosses';
import RouteEditor from '@/components/RouteEditor';
import BossTactics from '@/components/BossTactics';
import DungeonGuide from '@/components/DungeonGuide';
import { ROLES, EVENT_KINDS, PRIORITY, classColor } from '@/lib/wow';

const STATUSES = { going: 'Going', maybe: 'Maybe', not_going: "Can't make it" };

export default function EventPage() {
  const { id } = useParams();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [event, setEvent] = useState(null);
  const [signups, setSignups] = useState([]);
  const [myChars, setMyChars] = useState([]);
  const [needs, setNeeds] = useState([]);
  const [choice, setChoice] = useState({ character_id: '', role: 'dps', status: 'going' });
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [ev, su, ch] = await Promise.all([
      supabase.from('events').select('*, profiles!created_by(display_name), dungeons!dungeon_id(id, name)').eq('id', id).maybeSingle(),
      supabase.from('event_signups').select('*, profiles(display_name), characters(name, class, level)').eq('event_id', id),
      supabase.from('characters').select('*').eq('owner', userId).order('is_main', { ascending: false }),
    ]);
    const err = ev.error || su.error || ch.error;
    if (err) setError(err.message);
    setEvent(ev.data);
    setSignups(su.data ?? []);
    setMyChars(ch.data ?? []);

    // Loot from this dungeon that people signed up still need
    if (ev.data?.dungeon_id) {
      const attending = new Set((su.data ?? []).filter((s) => s.status !== 'not_going').map((s) => s.user_id));
      const { data: wl } = await supabase
        .from('wishlist')
        .select('*, items!inner(*), characters(id, name, class, owner)')
        .eq('items.dungeon_id', ev.data.dungeon_id)
        .eq('obtained', false)
        .order('priority');
      setNeeds((wl ?? []).filter((w) => attending.has(w.characters?.owner)));
    } else {
      setNeeds([]);
    }
    setLoaded(true);

    const mine = (su.data ?? []).find((s) => s.user_id === userId);
    if (mine) {
      setChoice({ character_id: mine.character_id ?? '', role: mine.role ?? 'dps', status: mine.status });
    } else if (ch.data?.length) {
      setChoice((c) => ({ ...c, character_id: ch.data[0].id, role: ch.data[0].role ?? 'dps' }));
    }
  }, [id, userId]);

  useEffect(() => { if (userId) load(); }, [load, userId]);

  if (!loaded) return <p className="muted">Loading…</p>;
  if (!event) return <p>{error ? <span className="error">Couldn&apos;t load this event: {error}</span> : 'Event not found.'} <Link href="/events">Back to events</Link></p>;

  const mySignup = signups.find((s) => s.user_id === userId);
  const going = signups.filter((s) => s.status === 'going');
  const maybe = signups.filter((s) => s.status === 'maybe');
  const notGoing = signups.filter((s) => s.status === 'not_going');
  const isCreator = event.created_by === userId;

  async function saveSignup(e) {
    e.preventDefault();
    setError('');
    const { error } = await supabase.from('event_signups').upsert({
      event_id: Number(id),
      user_id: userId,
      character_id: choice.character_id ? Number(choice.character_id) : null,
      role: choice.role,
      status: choice.status,
    });
    if (error) setError(error.message);
    load();
  }

  async function award(w) {
    setError('');
    const { error } = await supabase
      .from('loot_history')
      .insert({ item_id: w.item_id, character_id: w.character_id, event_id: Number(id) });
    if (error) setError(error.message);
    load();
  }

  async function withdraw() {
    await supabase.from('event_signups').delete().match({ event_id: Number(id), user_id: userId });
    load();
  }

  async function deleteEvent() {
    if (!confirm('Delete this event for everyone?')) return;
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) setError(error.message);
    else router.push('/events');
  }

  function pickCharacter(e) {
    const char = myChars.find((c) => String(c.id) === e.target.value);
    setChoice({ ...choice, character_id: e.target.value, role: char?.role ?? choice.role });
  }

  const SignupLine = ({ s }) => (
    <div className="signup">
      {s.characters ? (
        <>
          <Link href={`/characters/${s.character_id}`}><strong style={{ color: classColor(s.characters.class) }}>{s.characters.name}</strong></Link>{' '}
          <span className="muted small">{s.characters.level} {s.characters.class} · {s.profiles?.display_name}</span>
        </>
      ) : (
        <strong>{s.profiles?.display_name}</strong>
      )}
    </div>
  );

  return (
    <>
      <p><Link href="/events">← All events</Link></p>
      <div className="row spread">
        <h1>{event.title}</h1>
        {isCreator && <button className="btn danger small" onClick={deleteEvent}>Delete event</button>}
      </div>
      <p className="muted">
        {EVENT_KINDS[event.kind]?.label} · {formatWhen(event.starts_at)} · {going.length}/{event.max_size} going
        {event.profiles?.display_name && ` · organised by ${event.profiles.display_name}`}
        {event.dungeons && <> · <Link href={`/dungeons/${event.dungeons.id}`}>{event.dungeons.name} loot</Link></>}
      </p>
      {event.notes && <div className="panel" style={{ whiteSpace: 'pre-wrap' }}>{event.notes}</div>}
      {error && <p className="error">{error}</p>}

      <section className="panel">
        <h2>Group</h2>
        <div className="grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          {Object.entries(ROLES).map(([role, r]) => {
            const list = going.filter((s) => s.role === role);
            return (
              <div key={role} className="role-col">
                <h3>{r.icon} {role === 'dps' ? 'DPS' : `${r.label}s`} ({list.length})</h3>
                {list.length === 0 ? <p className="muted small">None yet</p> : list.map((s) => <SignupLine key={s.user_id} s={s} />)}
              </div>
            );
          })}
        </div>
        {(maybe.length > 0 || notGoing.length > 0) && (
          <div style={{ marginTop: '1rem' }}>
            {maybe.length > 0 && <p className="muted small">Maybe: {maybe.map((s) => s.characters?.name ?? s.profiles?.display_name).join(', ')}</p>}
            {notGoing.length > 0 && <p className="muted small">Can&apos;t make it: {notGoing.map((s) => s.profiles?.display_name).join(', ')}</p>}
          </div>
        )}
      </section>

      {event.dungeon_id && (
        <section className="panel">
          <div className="row spread">
            <h2>Before you go</h2>
            <div className="row">
              <Link href={`/dungeons/${event.dungeon_id}#routes`} className="small">All routes →</Link>
              <Link href={`/dungeons/${event.dungeon_id}#tactics`} className="small">Edit tactics →</Link>
            </div>
          </div>
          <DungeonGuide dungeonId={event.dungeon_id} compact />
          <h3 className="sub-head">Tank route</h3>
          <RouteEditor dungeonId={event.dungeon_id} userId={userId} readOnly onlyDefault />
          <h3 className="sub-head">Boss tactics</h3>
          <BossTactics dungeonId={event.dungeon_id} compact />
        </section>
      )}

      {event.dungeon_id && <EventBosses event={event} signups={signups} userId={userId} />}

      {event.dungeons && (
        <section className="panel">
          <h2>Loot this group needs</h2>
          {needs.length === 0 ? (
            <p className="muted">
              Nobody signed up has wishlisted anything from {event.dungeons.name} yet.{' '}
              <Link href={`/dungeons/${event.dungeons.id}`}>Browse its loot</Link>.
            </p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Item</th><th>Boss</th><th>For</th><th></th></tr></thead>
                <tbody>
                  {needs.map((w) => (
                    <tr key={w.id}>
                      <td><ItemName item={w.items} /></td>
                      <td className="muted">{w.items.boss ?? '—'}</td>
                      <td>
                        <Link href={`/characters/${w.characters.id}`} style={{ color: classColor(w.characters.class) }}>{w.characters.name}</Link>
                        {' '}<span className={`prio prio-${w.priority}`}>{PRIORITY[w.priority]}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn small" onClick={() => award(w)} title={`Record that ${w.characters.name} got this`}>Award</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="panel">
        <h2>{mySignup ? 'Your sign-up' : 'Sign up'}</h2>
        {myChars.length === 0 && (
          <p className="muted small">Tip: <Link href="/roster">add a character</Link> so others can see your class and level.</p>
        )}
        <form onSubmit={saveSignup} className="form-grid" style={{ alignItems: 'end' }}>
          <div>
            <label htmlFor="char">Character</label>
            <select id="char" value={choice.character_id} onChange={pickCharacter}>
              <option value="">— none —</option>
              {myChars.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.level} {c.class})</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="srole">Role</label>
            <select id="srole" value={choice.role} onChange={(e) => setChoice({ ...choice, role: e.target.value })}>
              {Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="status">Status</label>
            <select id="status" value={choice.status} onChange={(e) => setChoice({ ...choice, status: e.target.value })}>
              {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="row">
            <button className="btn" type="submit">{mySignup ? 'Update' : 'Sign up'}</button>
            {mySignup && <button type="button" className="btn ghost" onClick={withdraw}>Remove</button>}
          </div>
        </form>
      </section>
    </>
  );
}
