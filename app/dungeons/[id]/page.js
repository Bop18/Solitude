'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import ItemName from '@/components/ItemName';
import { CLASS_NAMES, ITEM_SLOTS, QUALITY, PRIORITY, classColor } from '@/lib/wow';

const EMPTY_ITEM = { name: '', boss: '', slot: '', item_type: '', quality: 'rare', classes: [], link: '', notes: '' };

export default function DungeonPage() {
  const { id } = useParams();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [dungeon, setDungeon] = useState(null);
  const [items, setItems] = useState([]);
  const [wishes, setWishes] = useState([]);
  const [myChars, setMyChars] = useState([]);
  const [wantAs, setWantAs] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [form, setForm] = useState(EMPTY_ITEM);
  const [showAdd, setShowAdd] = useState(false);
  const [picking, setPicking] = useState(null); // item id we're choosing a priority for
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [d, it, ch] = await Promise.all([
      supabase.from('dungeons').select('*').eq('id', id).maybeSingle(),
      supabase.from('items').select('*').eq('dungeon_id', id).order('boss', { nullsFirst: false }).order('name'),
      supabase.from('characters').select('*').eq('owner', userId).order('is_main', { ascending: false }),
    ]);
    const err = d.error || it.error || ch.error;
    if (err) setError(err.message);
    setDungeon(d.data);
    setItems(it.data ?? []);
    setMyChars(ch.data ?? []);
    setWantAs((cur) => cur || String(ch.data?.[0]?.id ?? ''));

    const ids = (it.data ?? []).map((i) => i.id);
    if (ids.length) {
      const w = await supabase
        .from('wishlist')
        .select('*, characters(id, name, class, owner)')
        .in('item_id', ids)
        .eq('obtained', false);
      if (w.error) setError(w.error.message);
      setWishes(w.data ?? []);
    } else {
      setWishes([]);
    }
    setLoaded(true);
  }, [id, userId]);

  useEffect(() => { if (userId) load(); }, [load, userId]);

  if (!loaded) return <p className="muted">Loading…</p>;
  if (!dungeon) return <p>Dungeon not found. <Link href="/dungeons">Back</Link></p>;

  const wantersOf = (itemId) => wishes.filter((w) => w.item_id === itemId);
  const iWant = (itemId) => wishes.find((w) => w.item_id === itemId && String(w.character_id) === wantAs);

  function startWant(itemId) {
    if (!wantAs) return setError('Add a character on the Roster page first, then you can want items.');
    setError('');
    setPicking(itemId);
  }

  // Each person adds their own request with their own priority.
  // Other people wanting the same item never blocks you.
  async function addWant(itemId, priority) {
    setError('');
    const { error } = await supabase
      .from('wishlist')
      .upsert({ character_id: Number(wantAs), item_id: itemId, priority, obtained: false }, { onConflict: 'character_id,item_id' });
    if (error) setError(error.message);
    setPicking(null);
    load();
  }

  async function changePriority(wishId, priority) {
    const { error } = await supabase.from('wishlist').update({ priority }).eq('id', wishId);
    if (error) setError(error.message);
    load();
  }

  async function removeWant(wishId) {
    const { error } = await supabase.from('wishlist').delete().eq('id', wishId);
    if (error) setError(error.message);
    load();
  }

  async function addItem(e) {
    e.preventDefault();
    setError('');
    const { error } = await supabase.from('items').insert({
      dungeon_id: Number(id),
      name: form.name.trim(),
      boss: form.boss.trim() || null,
      slot: form.slot || null,
      item_type: form.item_type.trim() || null,
      quality: form.quality,
      classes: form.classes,
      link: form.link.trim() || null,
      notes: form.notes.trim() || null,
    });
    if (error) return setError(error.message);
    // Keep the boss filled in: you often add several items from the same boss
    setForm({ ...EMPTY_ITEM, boss: form.boss, quality: form.quality });
    load();
  }

  async function deleteItem(item) {
    if (!confirm(`Delete ${item.name} from the list?`)) return;
    const { error } = await supabase.from('items').delete().eq('id', item.id);
    if (error) setError(error.message);
    load();
  }

  function toggleClass(cl) {
    setForm({ ...form, classes: form.classes.includes(cl) ? form.classes.filter((c) => c !== cl) : [...form.classes, cl] });
  }

  const shown = classFilter ? items.filter((i) => i.classes.includes(classFilter)) : items;

  // Group by boss
  const byBoss = {};
  for (const item of shown) (byBoss[item.boss || 'Trash / other'] ??= []).push(item);

  return (
    <>
      <p><Link href="/dungeons">← All dungeons</Link></p>
      <h1>{dungeon.name}</h1>
      <p className="muted">
        {dungeon.kind === 'raid' ? 'Raid' : 'Dungeon'}
        {dungeon.min_level ? ` · levels ${dungeon.min_level}–${dungeon.max_level ?? '?'}` : ''} · {dungeon.size}-player ·{' '}
        <a href={`https://www.wowhead.com/classic/search?q=${encodeURIComponent(dungeon.name)}`} target="_blank" rel="noreferrer">Look it up on Wowhead ↗</a>
      </p>
      {error && <p className="error">{error}</p>}

      <section className="panel">
        <div className="row spread">
          <div className="row">
            <label htmlFor="cf" style={{ margin: 0 }}>Show items for</label>
            <select id="cf" value={classFilter} onChange={(e) => setClassFilter(e.target.value)} style={{ width: 'auto' }}>
              <option value="">All classes</option>
              {CLASS_NAMES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          {myChars.length > 0 && (
            <div className="row">
              <label htmlFor="wa" style={{ margin: 0 }}>Wishlist for</label>
              <select id="wa" value={wantAs} onChange={(e) => setWantAs(e.target.value)} style={{ width: 'auto' }}>
                {myChars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
        </div>
      </section>

      {shown.length === 0 && (
        <section className="panel">
          <p className="muted">
            {items.length === 0
              ? 'No items listed yet. Add the drops worth knowing about below. Wowhead is a good place to check them.'
              : `No items tagged for ${classFilter} yet.`}
          </p>
        </section>
      )}

      {Object.entries(byBoss).map(([boss, list]) => (
        <section className="panel" key={boss}>
          <h2>{boss}</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Item</th><th>Slot</th><th>Good for</th><th>Wanted by</th><th></th></tr>
              </thead>
              <tbody>
                {list.map((item) => {
                  const wanters = wantersOf(item.id);
                  const mine = iWant(item.id);
                  return (
                    <tr key={item.id}>
                      <td>
                        <ItemName item={item} />
                        {item.notes && <div className="muted small">{item.notes}</div>}
                      </td>
                      <td className="muted">{[item.slot, item.item_type].filter(Boolean).join(' · ') || '—'}</td>
                      <td>
                        {item.classes.length === 0 ? <span className="muted">—</span> : item.classes.map((c) => (
                          <span key={c} className="badge" style={{ color: classColor(c), marginRight: 4 }}>{c}</span>
                        ))}
                      </td>
                      <td>
                        {wanters.length === 0 ? <span className="muted">—</span> : (
                          <div className="wanters">
                            {[...wanters].sort((a, b) => a.priority - b.priority).map((w) => (
                              <span key={w.id} className="wanter">
                                <Link href={`/characters/${w.characters.id}`} style={{ color: classColor(w.characters.class) }}>{w.characters.name}</Link>
                                <span className={`prio prio-${w.priority}`}>{PRIORITY[w.priority]}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {picking === item.id ? (
                          <div className="prio-picker">
                            <span className="muted small">How much?</span>
                            {[1, 2, 3].map((p) => (
                              <button key={p} className={`btn small prio-btn prio-btn-${p}`} onClick={() => addWant(item.id, p)}>{PRIORITY[p]}</button>
                            ))}
                            <button className="btn ghost small" onClick={() => setPicking(null)} aria-label="Cancel">✕</button>
                          </div>
                        ) : mine ? (
                          <div className="row" style={{ flexWrap: 'nowrap', gap: '0.4rem' }}>
                            <select
                              value={mine.priority}
                              onChange={(e) => changePriority(mine.id, Number(e.target.value))}
                              style={{ width: 'auto', padding: '0.3rem 0.5rem' }}
                              aria-label="Your priority"
                            >
                              {[1, 2, 3].map((p) => <option key={p} value={p}>{PRIORITY[p]}</option>)}
                            </select>
                            <button className="btn ghost small" onClick={() => removeWant(mine.id)} title="Remove from your wishlist">Remove</button>
                          </div>
                        ) : (
                          <button className="btn small" onClick={() => startWant(item.id)}>
                            {wanters.length ? 'Want too' : 'Want'}
                          </button>
                        )}
                        {item.created_by === userId && picking !== item.id && (
                          <button className="btn danger small" style={{ marginLeft: 6 }} onClick={() => deleteItem(item)} aria-label="Delete item">✕</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section className="panel">
        <div className="row spread">
          <h2>Add an item</h2>
          <button className="btn ghost small" onClick={() => setShowAdd(!showAdd)}>{showAdd ? 'Hide' : 'Show form'}</button>
        </div>
        {showAdd && (
          <form onSubmit={addItem} className="stack">
            <div className="form-grid">
              <div><label htmlFor="iname">Item name</label><input id="iname" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><label htmlFor="iboss">Boss</label><input id="iboss" value={form.boss} onChange={(e) => setForm({ ...form, boss: e.target.value })} placeholder="Leave blank for trash" /></div>
              <div>
                <label htmlFor="islot">Slot</label>
                <select id="islot" value={form.slot} onChange={(e) => setForm({ ...form, slot: e.target.value })}>
                  <option value="">—</option>
                  {ITEM_SLOTS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div><label htmlFor="itype">Type</label><input id="itype" value={form.item_type} onChange={(e) => setForm({ ...form, item_type: e.target.value })} placeholder="Cloth, Mail, Sword…" /></div>
              <div>
                <label htmlFor="iq">Quality</label>
                <select id="iq" value={form.quality} onChange={(e) => setForm({ ...form, quality: e.target.value })}>
                  {Object.entries(QUALITY).map(([k, q]) => <option key={k} value={k}>{q.label}</option>)}
                </select>
              </div>
              <div><label htmlFor="ilink">Link (optional)</label><input id="ilink" type="url" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="Wowhead URL" /></div>
            </div>
            <div>
              <label>Good for</label>
              <div className="row">
                {CLASS_NAMES.map((c) => (
                  <label key={c} className="checkbox" style={{ color: classColor(c), margin: 0 }}>
                    <input type="checkbox" checked={form.classes.includes(c)} onChange={() => toggleClass(c)} /> {c}
                  </label>
                ))}
              </div>
            </div>
            <div><label htmlFor="inotes">Notes</label><input id="inotes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="e.g. Best-in-slot until 40, quest reward alternative…" /></div>
            <button className="btn" type="submit">Add item</button>
          </form>
        )}
      </section>
    </>
  );
}
