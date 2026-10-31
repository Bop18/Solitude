'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { specsOf } from '@/lib/specs';
import { useAuth } from '@/components/AuthProvider';
import LevelBar from '@/components/LevelBar';
import { timeAgo } from '@/components/ActivityFeed';
import { ROLES, classColor, GAMES, gameOf, maxLevelFor, classesFor, racesFor } from '@/lib/wow';
import GameRealmFields from '@/components/GameRealmFields';

const EMPTY_FORM = { name: '', game: 'forever', realm: 'Normal', class: 'Warrior', race: '', role: 'dps', spec: '', level: 1, is_main: false };

// Synced from the game in the last 2 weeks? Then the level updates by itself.
const isSynced = (c) => c.synced_at && Date.now() - new Date(c.synced_at).getTime() < 14 * 86400000;

export default function RosterPage() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [characters, setCharacters] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('characters')
      .select('*, profiles(display_name)')
      .order('level', { ascending: false });
    if (error) setError(error.message);
    else setCharacters(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const mine = characters.filter((c) => c.owner === userId);

  async function addCharacter(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    if (form.is_main) {
      await supabase.from('characters').update({ is_main: false }).eq('owner', userId);
    }
    const { game, ...rest } = form;
    const { error } = await supabase.from('characters').insert({
      ...rest,
      ...(game !== 'forever' ? { game } : {}), // 'forever' is the database default
      name: form.name.trim(),
      realm: form.realm.trim() || null,
      race: form.race || null,
      spec: specsOf(form.class).length && form.spec ? form.spec : null,
      level: Number(form.level),
    });
    if (error) setError(error.message);
    else setForm(EMPTY_FORM);
    setBusy(false);
    load();
  }

  async function updateCharacter(id, changes) {
    const { error } = await supabase
      .from('characters')
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) setError(error.message);
    load();
  }

  async function makeMain(id) {
    // Only one main per player: clear the flag on the others first.
    await supabase.from('characters').update({ is_main: false }).eq('owner', userId).neq('id', id);
    updateCharacter(id, { is_main: true });
  }

  async function deleteCharacter(id, name) {
    if (!confirm(`Delete ${name}?`)) return;
    const { error } = await supabase.from('characters').delete().eq('id', id);
    if (error) setError(error.message);
    load();
  }

  const set = (field) => (e) =>
    setForm({ ...form, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  return (
    <>
      <h1>Roster</h1>
      {error && <p className="error">{error}</p>}

      <section className="panel">
        <h2>Everyone</h2>
        {characters.length === 0 ? (
          <p className="muted">No characters yet. Add yours below.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Character</th><th>Player</th><th>Class</th><th>Spec</th><th>Role</th><th>Level</th></tr>
              </thead>
              <tbody>
                {characters.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/characters/${c.id}`}><strong style={{ color: classColor(c.class) }}>{c.name}</strong></Link>
                      {c.is_main && <span className="badge gold" style={{ marginLeft: 6 }}>Main</span>}
                      <div className="muted small">{[gameOf(c) !== 'forever' && GAMES[gameOf(c)].label, c.realm].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td className="muted">{c.profiles?.display_name}</td>
                    <td>{c.race ? `${c.race} ` : ''}{c.class}</td>
                    <td>{specsOf(c.class).find((sp) => sp.id === c.spec)?.name ?? <span className="muted">—</span>}</td>
                    <td>{c.role ? `${ROLES[c.role].icon} ${ROLES[c.role].label}` : '—'}</td>
                    <td><LevelBar level={c.level} className={c.class} max={maxLevelFor(c)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid-2">
        <section className="panel">
          <h2>My characters</h2>
          {mine.length === 0 && <p className="muted">You haven&apos;t added any characters yet.</p>}
          <div className="stack">
            {mine.map((c) => (
              <div key={c.id} className="row spread" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                <div>
                  <Link href={`/characters/${c.id}`}><strong style={{ color: classColor(c.class) }}>{c.name}</strong></Link>{' '}
                  <span className="muted small">{c.class} · <Link href={`/characters/${c.id}`}>edit, gear &amp; wishlist</Link></span>
                </div>
                <div className="row">
                  {isSynced(c) ? (
                    // Level comes from the game automatically: no need to ding by hand
                    <span className="badge ok-badge" title={`Level and gear update from the game (via ${c.sync_source === 'battle.net' ? 'Battle.net' : 'the Solitude addon'})`}>
                      ⚡ Lv {c.level} · synced {timeAgo(c.synced_at)}
                    </span>
                  ) : (
                    <>
                      <button className="btn ghost small" onClick={() => updateCharacter(c.id, { level: Math.max(1, c.level - 1) })} aria-label="Level down">−</button>
                      <input
                        type="number" min={1} max={maxLevelFor(c)} defaultValue={c.level} key={c.level}
                        style={{ width: 70 }}
                        onBlur={(e) => {
                          const lvl = Math.min(maxLevelFor(c), Math.max(1, Number(e.target.value) || 1));
                          if (lvl !== c.level) updateCharacter(c.id, { level: lvl });
                        }}
                        aria-label="Level"
                      />
                      <button className="btn small" onClick={() => updateCharacter(c.id, { level: Math.min(maxLevelFor(c), c.level + 1) })} aria-label="Level up">Ding! +1</button>
                    </>
                  )}
                  {specsOf(c.class).length > 0 && (
                    <select value={c.spec ?? ''} style={{ width: 'auto' }} aria-label="Spec"
                      onChange={(e) => {
                        const sp = specsOf(c.class).find((x) => x.id === e.target.value);
                        updateCharacter(c.id, sp ? { spec: sp.id, role: sp.role } : { spec: null });
                      }}>
                      <option value="">Spec…</option>
                      {specsOf(c.class).map((sp) => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
                    </select>
                  )}
                  {c.spec && specsOf(c.class).some((sp) => sp.id === c.spec) ? (
                    <span className="badge" title="Set by the spec">{ROLES[c.role]?.icon} {ROLES[c.role]?.label}</span>
                  ) : (
                    <select value={c.role ?? 'dps'} onChange={(e) => updateCharacter(c.id, { role: e.target.value })} style={{ width: 'auto' }} aria-label="Role">
                      {Object.entries(ROLES).map(([key, r]) => <option key={key} value={key}>{r.label}</option>)}
                    </select>
                  )}
                  {!c.is_main && <button className="btn ghost small" onClick={() => makeMain(c.id)}>Make main</button>}
                  <button className="btn danger small" onClick={() => deleteCharacter(c.id, c.name)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>Add a character</h2>
          <form onSubmit={addCharacter} className="stack">
            <div className="form-grid">
              <div>
                <label htmlFor="cname">Name</label>
                <input id="cname" required value={form.name} onChange={set('name')} />
              </div>
              <GameRealmFields value={form} onChange={(patch) => setForm((f) => {
                const next = { ...f, ...patch };
                if (!classesFor(next.game).includes(next.class)) next.class = 'Warrior';
                if (next.race && !racesFor(next.game).includes(next.race)) next.race = '';
                next.level = Math.min(Number(next.level) || 1, maxLevelFor(next));
                return next;
              })} />
              <div>
                <label htmlFor="class">Class</label>
                <select id="class" value={form.class} onChange={(e) => setForm((f) => ({ ...f, class: e.target.value, spec: '' }))}>
                  {classesFor(form.game).map((cl) => <option key={cl}>{cl}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="race">Race</label>
                <select id="race" value={form.race} onChange={set('race')}>
                  <option value="">—</option>
                  {racesFor(form.game).map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
              {specsOf(form.class).length > 0 && (
                <div>
                  <label htmlFor="spec">Spec</label>
                  <select id="spec" value={form.spec}
                    onChange={(e) => { const sp = specsOf(form.class).find((x) => x.id === e.target.value); setForm((f) => ({ ...f, spec: e.target.value, role: sp?.role ?? f.role })); }}>
                    <option value="">Not sure yet</option>
                    {specsOf(form.class).map((sp) => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label htmlFor="role">Role{form.spec ? ' (from spec)' : ''}</label>
                <select id="role" value={form.role} onChange={set('role')} disabled={!!form.spec}>
                  {Object.entries(ROLES).map(([key, r]) => <option key={key} value={key}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="level">Level</label>
                <input id="level" type="number" min={1} max={maxLevelFor(form)} value={form.level} onChange={set('level')} />
              </div>
            </div>
            <label className="checkbox">
              <input type="checkbox" checked={form.is_main} onChange={set('is_main')} /> This is my main
            </label>
            <button className="btn" type="submit" disabled={busy}>Add character</button>
          </form>
        </section>
      </div>
    </>
  );
}
