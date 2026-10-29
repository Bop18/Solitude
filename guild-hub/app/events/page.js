'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import EventCard from '@/components/EventCard';
import { EVENT_KINDS } from '@/lib/wow';

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [dungeons, setDungeons] = useState([]);
  const [showPast, setShowPast] = useState(false);
  const [form, setForm] = useState({ title: '', kind: 'dungeon', starts_at: '', max_size: 5, notes: '', dungeon_id: '' });

  useEffect(() => {
    // Coming from "Plan a run" / "Plan it": fill in the time and dungeon
    const params = new URLSearchParams(window.location.search);
    const when = params.get('when');
    const dungeonId = params.get('dungeon');
    if (when) setForm((f) => ({ ...f, starts_at: when }));
    supabase.from('dungeons').select('id, name, kind, size').order('min_level').then(({ data }) => {
      setDungeons(data ?? []);
      const d = (data ?? []).find((x) => String(x.id) === dungeonId);
      if (d) setForm((f) => ({ ...f, dungeon_id: String(d.id), title: f.title || d.name, kind: d.kind, max_size: d.size ?? f.max_size }));
    });
  }, []);

  function pickDungeon(e) {
    const d = dungeons.find((x) => String(x.id) === e.target.value);
    const prev = dungeons.find((x) => String(x.id) === form.dungeon_id);
    setForm({
      ...form,
      dungeon_id: e.target.value,
      // Fill the title in for you, unless you've typed your own
      title: !form.title || form.title === prev?.name ? (d?.name ?? '') : form.title,
      kind: d?.kind ?? form.kind,
      max_size: d?.size ?? form.max_size,
    });
  }
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const now = new Date().toISOString();
    let query = supabase.from('events').select('*, event_signups(status)');
    query = showPast
      ? query.lt('starts_at', now).order('starts_at', { ascending: false }).limit(20)
      : query.gte('starts_at', now).order('starts_at', { ascending: true });
    const { data, error } = await query;
    if (error) setError(error.message);
    else setEvents(data);
  }, [showPast]);

  useEffect(() => { load(); }, [load]);

  async function createEvent(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await supabase.from('events').insert({
      title: form.title.trim(),
      kind: form.kind,
      // datetime-local gives local time with no zone; Date() treats it as local
      starts_at: new Date(form.starts_at).toISOString(),
      max_size: Number(form.max_size),
      notes: form.notes.trim() || null,
      dungeon_id: form.dungeon_id ? Number(form.dungeon_id) : null,
    });
    if (error) setError(error.message);
    else setForm({ title: '', kind: 'dungeon', starts_at: '', max_size: 5, notes: '', dungeon_id: '' });
    setBusy(false);
    load();
  }

  const set = (field) => (e) => {
    const value = e.target.value;
    if (field === 'kind') setForm({ ...form, kind: value, max_size: EVENT_KINDS[value].defaultSize });
    else setForm({ ...form, [field]: value });
  };

  return (
    <>
      <h1>Events</h1>
      {error && <p className="error">{error}</p>}

      <div className="grid-2">
        <section className="panel">
          <div className="row spread">
            <h2>{showPast ? 'Past runs' : 'Upcoming runs'}</h2>
            <button className="btn ghost small" onClick={() => setShowPast(!showPast)}>
              {showPast ? 'Show upcoming' : 'Show past'}
            </button>
          </div>
          {events.length === 0 ? (
            <p className="muted">{showPast ? 'No past events.' : 'Nothing planned yet. Create one!'}</p>
          ) : (
            <div className="event-list">
              {events.map((ev) => <EventCard key={ev.id} event={ev} />)}
            </div>
          )}
        </section>

        <section className="panel">
          <h2>Plan a run</h2>
          <form onSubmit={createEvent} className="stack">
            <div>
              <label htmlFor="dungeon">Dungeon / raid</label>
              <select id="dungeon" value={form.dungeon_id} onChange={pickDungeon}>
                <option value="">— not a specific dungeon —</option>
                {dungeons.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="title">Title</label>
              <input id="title" required value={form.title} onChange={set('title')} placeholder="e.g. Deadmines, Molten Core" />
            </div>
            <div className="form-grid">
              <div>
                <label htmlFor="kind">Type</label>
                <select id="kind" value={form.kind} onChange={set('kind')}>
                  {Object.entries(EVENT_KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="size">Group size</label>
                <input id="size" type="number" min={1} max={40} value={form.max_size} onChange={set('max_size')} />
              </div>
            </div>
            <div>
              <label htmlFor="when">When</label>
              <input id="when" type="datetime-local" required value={form.starts_at} onChange={set('starts_at')} />
            </div>
            <div>
              <label htmlFor="notes">Notes</label>
              <textarea id="notes" rows={3} value={form.notes} onChange={set('notes')} placeholder="Meeting point, consumables, quests to grab first…" />
            </div>
            <button className="btn" type="submit" disabled={busy}>Create event</button>
          </form>
        </section>
      </div>
    </>
  );
}
