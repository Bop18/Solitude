'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { timeAgo } from './ActivityFeed';

const ROLE_FIELDS = [
  { key: 'tank', label: '🛡️ Tanks', placeholder: 'Where to tank it, what to watch for…' },
  { key: 'healer', label: '✚ Healers', placeholder: 'Big damage phases, what to dispel…' },
  { key: 'dps', label: '⚔️ DPS', placeholder: 'Kill order, when to stop, what to interrupt…' },
];

// Boss-by-boss tactics for a dungeon. Anyone in the group can write or improve them.
// compact: read-only summary (used on event pages)
export default function BossTactics({ dungeonId, compact = false }) {
  const [bosses, setBosses] = useState([]);   // names, in order
  const [notes, setNotes] = useState({});     // lower(boss) → note
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({});
  const [newBoss, setNewBoss] = useState('');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [b, n] = await Promise.all([
      supabase.from('dungeon_bosses').select('boss, avg_ilvl').eq('dungeon_id', dungeonId),
      supabase.from('boss_notes').select('*, profiles(display_name)').eq('dungeon_id', dungeonId),
    ]);
    if (n.error) {
      setError('Tactics need the latest database update: run supabase/schema-8-tactics-routes.sql in Supabase.');
      setLoaded(true);
      return;
    }
    const fromLoot = (b.data ?? []).sort((x, y) => (x.avg_ilvl ?? 0) - (y.avg_ilvl ?? 0)).map((r) => r.boss);
    const noteList = n.data ?? [];
    const posOf = (name) => noteList.find((x) => x.boss.toLowerCase() === name.toLowerCase())?.position;
    const all = [...new Set([...noteList.map((x) => x.boss), ...fromLoot.filter((bb) => !noteList.some((x) => x.boss.toLowerCase() === bb.toLowerCase()))])];
    setBosses(all.sort((a, b2) => (posOf(a) ?? 1000 + fromLoot.indexOf(a)) - (posOf(b2) ?? 1000 + fromLoot.indexOf(b2))));
    setNotes(Object.fromEntries((n.data ?? []).map((x) => [x.boss.toLowerCase(), x])));
    setLoaded(true);
  }, [dungeonId]);

  useEffect(() => { load(); }, [load]);

  function startEdit(boss) {
    const n = notes[boss.toLowerCase()] ?? {};
    setDraft({ summary: n.summary ?? '', tank: n.tank ?? '', healer: n.healer ?? '', dps: n.dps ?? '' });
    setEditing(boss);
  }

  async function save(boss) {
    setError('');
    const existing = notes[boss.toLowerCase()];
    const values = {
      summary: draft.summary.trim() || null,
      tank: draft.tank.trim() || null,
      healer: draft.healer.trim() || null,
      dps: draft.dps.trim() || null,
    };
    const { error } = existing
      ? await supabase.from('boss_notes').update(values).eq('id', existing.id)
      : await supabase.from('boss_notes').insert({ dungeon_id: dungeonId, boss, position: bosses.length, ...values });
    if (error) return setError(error.message);
    setEditing(null);
    load();
  }

  async function addBoss(e) {
    e.preventDefault();
    const name = newBoss.trim();
    if (!name) return;
    if (bosses.some((b) => b.toLowerCase() === name.toLowerCase())) return setError(`${name} is already listed.`);
    const { error } = await supabase.from('boss_notes').insert({ dungeon_id: dungeonId, boss: name, position: bosses.length });
    if (error) return setError(error.message);
    setNewBoss('');
    await load();
    startEdit(name);
  }

  if (!loaded) return <p className="muted">Loading…</p>;

  // ---------- Compact (event page) ----------
  if (compact) {
    const written = bosses.filter((b) => notes[b.toLowerCase()]);
    if (!written.length) return <p className="muted small">No tactics written for this dungeon yet.</p>;
    return (
      <div className="tactics-compact">
        {written.map((b) => {
          const n = notes[b.toLowerCase()];
          return (
            <details key={b}>
              <summary><strong>{b}</strong>{n.summary && <span className="muted">: {n.summary.split('\n')[0]}</span>}</summary>
              <TacticBody note={n} />
            </details>
          );
        })}
      </div>
    );
  }

  // ---------- Full (dungeon page) ----------
  return (
    <>
      {error && <p className="error">{error}</p>}
      {bosses.length === 0 && <p className="muted">No bosses listed yet. Add one below.</p>}
      <div className="tactics-list">
        {bosses.map((boss, i) => {
          const n = notes[boss.toLowerCase()];
          const isEditing = editing === boss;
          return (
            <section key={boss} className="panel tactic">
              <div className="row spread">
                <h2 style={{ marginBottom: 0 }}><span className="muted" style={{ marginRight: 8 }}>{i + 1}</span>{boss}</h2>
                {!isEditing && (
                  <button className="btn ghost small" onClick={() => startEdit(boss)}>{n ? '✎ Edit' : '+ Write tactics'}</button>
                )}
              </div>

              {isEditing ? (
                <div className="stack" style={{ marginTop: '0.8rem' }}>
                  <div>
                    <label>The fight in a sentence or two</label>
                    <textarea rows={2} value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} placeholder="e.g. Banish the 2 adds, tank Garr away from the rest, kill Garr last." />
                  </div>
                  <div className="form-grid">
                    {ROLE_FIELDS.map((f) => (
                      <div key={f.key}>
                        <label>{f.label}</label>
                        <textarea rows={3} value={draft[f.key]} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} placeholder={f.placeholder} />
                      </div>
                    ))}
                  </div>
                  <div className="row">
                    <button className="btn small" onClick={() => save(boss)}>Save</button>
                    <button className="btn ghost small" onClick={() => setEditing(null)}>Cancel</button>
                  </div>
                </div>
              ) : n ? (
                <>
                  <TacticBody note={n} />
                  <p className="muted small" style={{ margin: '0.6rem 0 0' }}>
                    {n.source === 'guide'
                      ? <><span className="badge">Starter guide</span> Improve it with what works for your group.</>
                      : <>Last edited {timeAgo(n.updated_at)}{n.profiles?.display_name ? ` by ${n.profiles.display_name}` : ''}</>}
                    {' · '}<a href={`https://www.wowhead.com/classic/search?q=${encodeURIComponent(boss)}`} target="_blank" rel="noreferrer">More on Wowhead ↗</a>
                  </p>
                </>
              ) : (
                <p className="muted small" style={{ margin: '0.4rem 0 0' }}>No tactics yet.</p>
              )}
            </section>
          );
        })}
      </div>

      <form onSubmit={addBoss} className="panel row">
        <input value={newBoss} onChange={(e) => setNewBoss(e.target.value)} placeholder="Boss missing? Add its name (e.g. new WoW: Forever bosses)" style={{ flex: 1 }} />
        <button className="btn small" type="submit">+ Add boss</button>
      </form>
    </>
  );
}

function TacticBody({ note }) {
  return (
    <div className="tactic-body">
      {note.summary && <p className="tactic-summary">{note.summary}</p>}
      <div className="tactic-roles">
        {ROLE_FIELDS.filter((f) => note[f.key]).map((f) => (
          <div key={f.key} className="tactic-role">
            <div className="tactic-role-label">{f.label}</div>
            <div className="tactic-role-text">{note[f.key]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
