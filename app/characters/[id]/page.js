'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import ItemName from '@/components/ItemName';
import LevelBar from '@/components/LevelBar';
import { GEAR_SLOTS, PRIORITY, ROLES, CLASS_NAMES, RACES, MAX_LEVEL, classColor } from '@/lib/wow';

export default function CharacterPage() {
  const { id } = useParams();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [char, setChar] = useState(null);
  const [gear, setGear] = useState({});      // slot -> row
  const [edits, setEdits] = useState({});    // slot -> text being typed
  const [wishes, setWishes] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [editForm, setEditForm] = useState(null); // null = not editing
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    const [c, g, w, it] = await Promise.all([
      supabase.from('characters').select('*, profiles(display_name)').eq('id', id).maybeSingle(),
      supabase.from('character_gear').select('*, items(*)').eq('character_id', id),
      supabase.from('wishlist').select('*, items(*, dungeons(id, name))').eq('character_id', id).order('obtained').order('priority'),
      supabase.from('items').select('id, name, quality'),
    ]);
    const err = c.error || g.error || w.error || it.error;
    if (err) setError(err.message);
    setChar(c.data);
    setGear(Object.fromEntries((g.data ?? []).map((row) => [row.slot, row])));
    setWishes(w.data ?? []);
    setAllItems(it.data ?? []);
    setLoaded(true);
  }, [id]);

  useEffect(() => { if (userId) load(); }, [load, userId]);

  if (!loaded) return <p className="muted">Loading…</p>;
  if (!char) return <p>Character not found. <Link href="/roster">Back to roster</Link></p>;

  const isMine = char.owner === userId;

  async function saveSlot(slot) {
    const text = (edits[slot] ?? '').trim();
    setError('');
    if (!text) return;
    const match = allItems.find((i) => i.name.toLowerCase() === text.toLowerCase());
    const { error } = await supabase.from('character_gear').upsert({
      character_id: Number(id),
      slot,
      item_name: match?.name ?? text,
      item_id: match?.id ?? null,
      updated_at: new Date().toISOString(),
    });
    if (error) return setError(error.message);

    // Got something off your wishlist? Tick it off automatically.
    if (match) {
      const wish = wishes.find((w) => w.item_id === match.id && !w.obtained);
      if (wish) await supabase.from('wishlist').update({ obtained: true }).eq('id', wish.id);
    }
    setEdits({ ...edits, [slot]: undefined });
    load();
  }

  async function clearSlot(slot) {
    const { error } = await supabase.from('character_gear').delete().match({ character_id: Number(id), slot });
    if (error) setError(error.message);
    load();
  }

  async function updateWish(wishId, changes) {
    const { error } = await supabase.from('wishlist').update(changes).eq('id', wishId);
    if (error) setError(error.message);
    load();
  }

  async function removeWish(wishId) {
    const { error } = await supabase.from('wishlist').delete().eq('id', wishId);
    if (error) setError(error.message);
    load();
  }

  const openWishes = wishes.filter((w) => !w.obtained);
  function startEdit() {
    setEditForm({
      name: char.name,
      realm: char.realm ?? '',
      class: char.class,
      race: char.race ?? '',
      role: char.role ?? 'dps',
      level: char.level,
      is_main: char.is_main,
    });
  }

  const setField = (field) => (e) =>
    setEditForm({ ...editForm, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function saveEdit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    // Only one main per player
    if (editForm.is_main && !char.is_main) {
      await supabase.from('characters').update({ is_main: false }).eq('owner', userId).neq('id', char.id);
    }
    const { error } = await supabase
      .from('characters')
      .update({
        name: editForm.name.trim(),
        realm: editForm.realm.trim() || null,
        class: editForm.class,
        race: editForm.race || null,
        role: editForm.role,
        level: Math.min(MAX_LEVEL, Math.max(1, Number(editForm.level) || 1)),
        is_main: editForm.is_main,
        updated_at: new Date().toISOString(),
      })
      .eq('id', char.id);
    setSaving(false);
    if (error) return setError(error.message);
    setEditForm(null);
    load();
  }

  async function deleteCharacter() {
    if (!confirm(`Delete ${char.name}? Their gear and wishlist will be deleted too.`)) return;
    const { error } = await supabase.from('characters').delete().eq('id', char.id);
    if (error) return setError(error.message);
    router.push('/roster');
  }

  const doneWishes = wishes.filter((w) => w.obtained);
  const filled = GEAR_SLOTS.filter((s) => gear[s]).length;

  return (
    <>
      <p><Link href="/roster">← Roster</Link></p>
      <div className="row spread">
        <h1 style={{ color: classColor(char.class) }}>{char.name}</h1>
        {isMine && !editForm && (
          <button className="btn ghost small" onClick={startEdit}>✎ Edit character</button>
        )}
      </div>

      {isMine && editForm && (
        <form onSubmit={saveEdit} className="panel stack">
          <h2>Edit character</h2>
          <div className="form-grid">
            <div>
              <label htmlFor="ename">Name</label>
              <input id="ename" required value={editForm.name} onChange={setField('name')} />
            </div>
            <div>
              <label htmlFor="erealm">Realm</label>
              <input id="erealm" value={editForm.realm} onChange={setField('realm')} placeholder="Optional" />
            </div>
            <div>
              <label htmlFor="eclass">Class</label>
              <select id="eclass" value={editForm.class} onChange={setField('class')}>
                {/* Keep an old class selectable even if it's been removed from the list */}
                {!CLASS_NAMES.includes(editForm.class) && <option>{editForm.class}</option>}
                {CLASS_NAMES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="erace">Race</label>
              <select id="erace" value={editForm.race} onChange={setField('race')}>
                <option value="">—</option>
                {editForm.race && !RACES.includes(editForm.race) && <option>{editForm.race}</option>}
                {RACES.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="erole">Role</label>
              <select id="erole" value={editForm.role} onChange={setField('role')}>
                {Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="elevel">Level</label>
              <input id="elevel" type="number" min={1} max={MAX_LEVEL} value={editForm.level} onChange={setField('level')} />
            </div>
          </div>
          <label className="checkbox">
            <input type="checkbox" checked={editForm.is_main} onChange={setField('is_main')} /> This is my main
          </label>
          <div className="row spread">
            <div className="row">
              <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
              <button className="btn ghost" type="button" onClick={() => setEditForm(null)}>Cancel</button>
            </div>
            <button className="btn danger" type="button" onClick={deleteCharacter}>Delete character</button>
          </div>
        </form>
      )}

      <p className="muted">
        {char.race ? `${char.race} ` : ''}{char.class}
        {char.role ? ` · ${ROLES[char.role].label}` : ''}
        {char.realm ? ` · ${char.realm}` : ''} · played by {char.profiles?.display_name}
      </p>
      <div style={{ maxWidth: 320, marginBottom: '1.25rem' }}><LevelBar level={char.level} className={char.class} /></div>
      {error && <p className="error">{error}</p>}

      <div className="grid-2">
        <section className="panel">
          <div className="row spread">
            <h2>Gear</h2>
            <span className="muted small">{filled}/{GEAR_SLOTS.length} slots</span>
          </div>
          {isMine && <p className="muted small">Type what you&apos;re wearing and press Enter. Items from the dungeon lists autocomplete and get coloured.</p>}
          <datalist id="item-names">
            {allItems.map((i) => <option key={i.id} value={i.name} />)}
          </datalist>
          <table>
            <tbody>
              {GEAR_SLOTS.map((slot) => {
                const row = gear[slot];
                const editing = edits[slot] !== undefined;
                return (
                  <tr key={slot}>
                    <td className="muted small" style={{ width: 90 }}>{slot}</td>
                    <td>
                      {isMine && editing ? (
                        <form className="row" style={{ flexWrap: 'nowrap' }} onSubmit={(e) => { e.preventDefault(); saveSlot(slot); }}>
                          <input
                            list="item-names" autoFocus value={edits[slot]}
                            onChange={(e) => setEdits({ ...edits, [slot]: e.target.value })}
                            onKeyDown={(e) => e.key === 'Escape' && setEdits({ ...edits, [slot]: undefined })}
                            aria-label={`${slot} item`}
                          />
                          <button className="btn small" type="submit">Save</button>
                        </form>
                      ) : row ? (
                        <ItemName item={row.items ?? { name: row.item_name, quality: 'common' }} />
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    {isMine && !editing && (
                      <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                        <button className="btn ghost small" onClick={() => setEdits({ ...edits, [slot]: row?.item_name ?? '' })}>{row ? 'Change' : 'Add'}</button>
                        {row && <button className="btn ghost small" style={{ marginLeft: 4 }} onClick={() => clearSlot(slot)} aria-label={`Clear ${slot}`}>✕</button>}
                      </td>
                    )}
                    {isMine && editing && <td />}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="panel">
          <h2>Wishlist</h2>
          {openWishes.length === 0 && (
            <p className="muted">
              Nothing wanted yet.{isMine && <> Open a <Link href="/dungeons">dungeon</Link> and hit <strong>Want</strong> on items.</>}
            </p>
          )}
          <div className="stack">
            {openWishes.map((w) => (
              <div key={w.id} className="row spread" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.6rem' }}>
                <div>
                  <ItemName item={w.items} />
                  <div className="muted small">
                    {w.items.dungeons ? <Link href={`/dungeons/${w.items.dungeons.id}`}>{w.items.dungeons.name}</Link> : 'Unknown source'}
                    {w.items.boss ? ` · ${w.items.boss}` : ''}
                    {w.items.slot ? ` · ${w.items.slot}` : ''}
                  </div>
                </div>
                {isMine ? (
                  <div className="row">
                    <select value={w.priority} onChange={(e) => updateWish(w.id, { priority: Number(e.target.value) })} style={{ width: 'auto' }} aria-label="Priority">
                      {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <button className="btn small" onClick={() => updateWish(w.id, { obtained: true })}>Got it!</button>
                    <button className="btn ghost small" onClick={() => removeWish(w.id)} aria-label="Remove">✕</button>
                  </div>
                ) : (
                  <span className="badge">{PRIORITY[w.priority]}</span>
                )}
              </div>
            ))}
          </div>

          {doneWishes.length > 0 && (
            <>
              <h3 style={{ marginTop: '1.25rem', fontSize: '1rem' }} className="muted">Got ({doneWishes.length})</h3>
              <div className="row">
                {doneWishes.map((w) => (
                  <span key={w.id} style={{ opacity: 0.7 }}>
                    <ItemName item={w.items} />
                    {isMine && (
                      <button className="btn ghost small" style={{ marginLeft: 4 }} onClick={() => updateWish(w.id, { obtained: false })} title="Move back to wishlist">↺</button>
                    )}
                  </span>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
