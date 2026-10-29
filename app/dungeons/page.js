'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import ImportItems from '@/components/ImportItems';
import ImportGuides from '@/components/ImportGuides';

export default function DungeonsPage() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [dungeons, setDungeons] = useState([]);
  const [myLevel, setMyLevel] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', kind: 'dungeon', min_level: '', max_level: '', size: 5 });
  const [error, setError] = useState('');
  const [hasGameData, setHasGameData] = useState(true); // null = database not updated yet
  const [needsGuides, setNeedsGuides] = useState(false);

  const load = useCallback(async () => {
    const [d, w, c, gd] = await Promise.all([
      supabase.from('dungeons').select('*, items(id)').order('min_level', { ascending: true, nullsFirst: false }),
      supabase.from('wishlist').select('items(dungeon_id)').eq('obtained', false),
      supabase.from('characters').select('level, is_main').eq('owner', userId),
      supabase.from('items').select('id', { count: 'exact', head: true }).not('game_id', 'is', null),
    ]);
    const err = d.error || w.error || c.error;
    if (err) return setError(err.message);
    setHasGameData(gd.error ? null : (gd.count ?? 0) > 0);
    // Starter guides loaded yet? (hidden if the database doesn't have the guide columns yet)
    const gq = await supabase.from('dungeons').select('id', { count: 'exact', head: true }).not('guide_overview', 'is', null);
    setNeedsGuides(!gq.error && (gq.count ?? 0) === 0);

    const wanted = {};
    for (const row of w.data) {
      const id = row.items?.dungeon_id;
      if (id) wanted[id] = (wanted[id] ?? 0) + 1;
    }
    setDungeons(d.data.map((dg) => ({ ...dg, itemCount: (dg.items ?? []).length, wantedCount: wanted[dg.id] ?? 0 })));

    const main = c.data.find((ch) => ch.is_main) ?? c.data.sort((a, b) => b.level - a.level)[0];
    setMyLevel(main?.level ?? null);
  }, [userId]);

  useEffect(() => { if (userId) load(); }, [load, userId]);

  async function addDungeon(e) {
    e.preventDefault();
    setError('');
    const { error } = await supabase.from('dungeons').insert({
      name: form.name.trim(),
      kind: form.kind,
      min_level: form.min_level ? Number(form.min_level) : null,
      max_level: form.max_level ? Number(form.max_level) : null,
      size: Number(form.size),
    });
    if (error) return setError(error.message);
    setForm({ name: '', kind: 'dungeon', min_level: '', max_level: '', size: 5 });
    setShowAdd(false);
    load();
  }

  const fitsMe = (d) => myLevel != null && d.min_level != null && myLevel >= d.min_level - 2 && myLevel <= (d.max_level ?? 60);

  const Section = ({ title, list }) => (
    <section className="panel">
      <h2>{title}</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Name</th><th>Levels</th><th>Size</th><th>Items</th><th>Needed</th></tr>
          </thead>
          <tbody>
            {list.map((d) => (
              <tr key={d.id}>
                <td>
                  <Link href={`/dungeons/${d.id}`}><strong>{d.name}</strong></Link>
                  {fitsMe(d) && <span className="badge gold" style={{ marginLeft: 6 }}>Your level</span>}
                </td>
                <td className="muted">{d.min_level ? `${d.min_level}–${d.max_level ?? '?'}` : '—'}</td>
                <td className="muted">{d.size}</td>
                <td>{d.itemCount || <span className="muted">0</span>}</td>
                <td>{d.wantedCount ? <span className="badge gold">{d.wantedCount}</span> : <span className="muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );

  return (
    <>
      <div className="row spread">
        <h1>Dungeons &amp; Raids</h1>
        <button className="btn ghost small" onClick={() => setShowAdd(!showAdd)}>{showAdd ? 'Cancel' : '+ Add dungeon'}</button>
      </div>
      <p className="muted">Open a dungeon to see every drop, who it&apos;s best for, and what&apos;s an upgrade for your group.</p>
      {error && <p className="error">{error}</p>}
      {hasGameData === false && <ImportItems onDone={load} />}
      {needsGuides && <ImportGuides onDone={load} />}
      {hasGameData === null && (
        <section className="panel"><p className="muted">To get the automatic loot list, run <code>supabase/schema-3-auto-loot.sql</code> in Supabase first.</p></section>
      )}

      {showAdd && (
        <form onSubmit={addDungeon} className="panel stack">
          <div className="form-grid">
            <div><label htmlFor="dn">Name</label><input id="dn" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <label htmlFor="dk">Type</label>
              <select id="dk" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value, size: e.target.value === 'raid' ? 40 : 5 })}>
                <option value="dungeon">Dungeon</option><option value="raid">Raid</option>
              </select>
            </div>
            <div><label htmlFor="dmin">Min level</label><input id="dmin" type="number" value={form.min_level} onChange={(e) => setForm({ ...form, min_level: e.target.value })} /></div>
            <div><label htmlFor="dmax">Max level</label><input id="dmax" type="number" value={form.max_level} onChange={(e) => setForm({ ...form, max_level: e.target.value })} /></div>
            <div><label htmlFor="ds">Group size</label><input id="ds" type="number" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} /></div>
          </div>
          <button className="btn" type="submit">Add</button>
        </form>
      )}

      <Section title="Dungeons" list={dungeons.filter((d) => d.kind === 'dungeon')} />
      <Section title="Raids" list={dungeons.filter((d) => d.kind === 'raid')} />
    </>
  );
}
