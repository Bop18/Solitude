'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import ItemName from '@/components/ItemName';
import ItemSearch from '@/components/ItemSearch';
import LootTabs from '@/components/LootTabs';
import { classColor } from '@/lib/wow';

export default function LootHistoryPage() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [rows, setRows] = useState([]);
  const [roster, setRoster] = useState([]);
  const [playerFilter, setPlayerFilter] = useState('');
  const [adding, setAdding] = useState(false);
  const [pickedItem, setPickedItem] = useState(null);
  const [charId, setCharId] = useState('');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [h, ch] = await Promise.all([
      supabase
        .from('loot_history')
        .select('*, items(*, dungeons(id, name)), characters(id, name, class, owner, profiles(display_name)), events(id, title)')
        .order('received_at', { ascending: false })
        .limit(300),
      supabase.from('characters').select('id, name, class, owner, profiles(display_name)').order('name'),
    ]);
    const err = h.error || ch.error;
    if (err) setError(err.message);
    setRows(h.data ?? []);
    setRoster(ch.data ?? []);
    setLoaded(true);
  }, []);

  useEffect(() => { if (userId) load(); }, [load, userId]);

  async function record(e) {
    e.preventDefault();
    if (!pickedItem || !charId) return setError('Pick an item and who got it.');
    setError('');
    const { error } = await supabase.from('loot_history').insert({ item_id: pickedItem.id, character_id: Number(charId) });
    if (error) return setError(error.message);
    setPickedItem(null);
    setAdding(false);
    load();
  }

  async function remove(id) {
    if (!confirm('Remove this loot record?')) return;
    const { error } = await supabase.from('loot_history').delete().eq('id', id);
    if (error) setError(error.message);
    load();
  }

  // Players for the filter
  const players = [...new Map(roster.map((c) => [c.owner, c.profiles?.display_name ?? '?'])).entries()];
  const shown = playerFilter ? rows.filter((r) => r.characters?.owner === playerFilter) : rows;

  // Fairness at a glance: items received per player
  const counts = {};
  for (const r of rows) {
    const p = r.characters?.profiles?.display_name ?? '?';
    counts[p] = (counts[p] ?? 0) + 1;
  }

  return (
    <>
      <h1>Loot history</h1>
      <LootTabs />
      {error && <p className="error">{error}</p>}

      <div className="grid-2">
        <section className="panel">
          <h2>Who&apos;s had what</h2>
          {Object.keys(counts).length === 0 ? <p className="muted">No loot recorded yet.</p> : (
            <div className="stack">
              {Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, n]) => (
                <div key={name} className="row spread">
                  <span>{name}</span>
                  <span className="badge">{n} item{n === 1 ? '' : 's'}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="row spread">
            <h2>Record loot</h2>
            {!adding && <button className="btn small" onClick={() => setAdding(true)}>+ Record</button>}
          </div>
          {adding ? (
            <form onSubmit={record} className="stack">
              <div>
                <label>Item</label>
                {pickedItem ? (
                  <div className="row"><ItemName item={pickedItem} /><button type="button" className="btn ghost small" onClick={() => setPickedItem(null)}>Change</button></div>
                ) : (
                  <ItemSearch onPick={setPickedItem} autoFocus />
                )}
              </div>
              <div>
                <label htmlFor="who">Who got it</label>
                <select id="who" value={charId} onChange={(e) => setCharId(e.target.value)} required>
                  <option value="">Choose a character…</option>
                  {roster.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.profiles?.display_name})</option>)}
                </select>
              </div>
              <div className="row">
                <button className="btn" type="submit">Save</button>
                <button className="btn ghost" type="button" onClick={() => setAdding(false)}>Cancel</button>
              </div>
            </form>
          ) : (
            <p className="muted small">Usually you&apos;ll press <strong>Looted</strong> on a dungeon or event page instead. This is for anything else.</p>
          )}
        </section>
      </div>

      <section className="panel">
        <div className="row spread">
          <h2>History</h2>
          <select value={playerFilter} onChange={(e) => setPlayerFilter(e.target.value)} style={{ width: 'auto' }} aria-label="Filter by player">
            <option value="">Everyone</option>
            {players.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>
        {loaded && shown.length === 0 ? <p className="muted">Nothing recorded yet.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>When</th><th>Item</th><th>Who</th><th>Where</th><th></th></tr></thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td className="muted small" style={{ whiteSpace: 'nowrap' }}>
                      {new Date(r.received_at).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                    </td>
                    <td><ItemName item={r.items} /></td>
                    <td>
                      <Link href={`/characters/${r.characters.id}`} style={{ color: classColor(r.characters.class) }}>{r.characters.name}</Link>
                      <span className="muted small"> {r.characters.profiles?.display_name}</span>
                    </td>
                    <td className="muted small">
                      {r.events ? <Link href={`/events/${r.events.id}`}>{r.events.title}</Link>
                        : r.items.dungeons ? <Link href={`/dungeons/${r.items.dungeons.id}`}>{r.items.dungeons.name}</Link> : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {(r.recorded_by === userId || r.characters.owner === userId) && (
                        <button className="btn ghost small" onClick={() => remove(r.id)} aria-label="Remove">✕</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
