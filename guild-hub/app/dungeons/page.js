'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import ImportItems from '@/components/ImportItems';
import ImportGuides from '@/components/ImportGuides';
import ImportRetail from '@/components/ImportRetail';
import { classColor } from '@/lib/wow';

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
  const [game, setGame] = useState('classic');
  const [search, setSearch] = useState('');
  const [tonight, setTonight] = useState(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('game') === 'retail') setGame('retail');
  }, []);
  const pickGame = (g) => (e) => {
    e.preventDefault();
    setGame(g);
    setSearch('');
    window.history.replaceState(null, '', g === 'retail' ? '?game=retail' : window.location.pathname);
  };

  const load = useCallback(async () => {
    const [d, w, c, gd] = await Promise.all([
      supabase.from('dungeons').select('*, items(id)').order('min_level', { ascending: true, nullsFirst: false }),
      supabase.from('wishlist').select('item_id, items(dungeon_id), characters(id, name, class)').eq('obtained', false),
      supabase.from('characters').select('*').eq('owner', userId),
      supabase.from('items').select('id', { count: 'exact', head: true }).not('game_id', 'is', null),
    ]);
    const err = d.error || w.error || c.error;
    if (err) return setError(err.message);
    setHasGameData(gd.error ? null : (gd.count ?? 0) > 0);
    // Starter guides loaded yet? (hidden if the database doesn't have the guide columns yet)
    const gq = await supabase.from('dungeons').select('id', { count: 'exact', head: true }).not('guide_overview', 'is', null);
    setNeedsGuides(!gq.error && (gq.count ?? 0) === 0);

    // Who needs what, per dungeon
    const wanted = {};
    for (const row of w.data) {
      const id = row.items?.dungeon_id;
      if (!id) continue;
      const e = (wanted[id] ??= { items: new Set(), people: new Map() });
      e.items.add(row.item_id);
      if (row.characters) e.people.set(row.characters.id, row.characters);
    }
    setDungeons(d.data.map((dg) => ({
      ...dg,
      itemCount: (dg.items ?? []).length,
      wantedCount: wanted[dg.id]?.items.size ?? 0,
      people: [...(wanted[dg.id]?.people.values() ?? [])],
    })));

    // A run tonight? Its dungeon goes first
    const ev = await supabase.from('events').select('id, title, starts_at, dungeon_id').not('dungeon_id', 'is', null)
      .gte('starts_at', new Date(Date.now() - 3 * 3600e3).toISOString())
      .lte('starts_at', new Date(Date.now() + 14 * 3600e3).toISOString()).order('starts_at').limit(1);
    setTonight(ev.data?.[0] ?? null);

    const classicChars = c.data.filter((ch) => ch.game !== 'retail');
    const main = classicChars.find((ch) => ch.is_main) ?? classicChars.sort((a, b) => b.level - a.level)[0];
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
      ...(game === 'retail' ? { game: 'retail' } : {}),
    });
    if (error) return setError(error.message);
    setForm({ name: '', kind: 'dungeon', min_level: '', max_level: '', size: 5 });
    setShowAdd(false);
    load();
  }

  const fitsMe = (d) => game === 'classic' && myLevel != null && d.min_level != null && myLevel >= d.min_level - 2 && myLevel <= (d.max_level ?? 60);

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
                <td className="muted">{d.min_level ? `${d.min_level}${d.max_level ? `–${d.max_level}` : '+'}` : '—'}</td>
                <td className="muted">{d.size}</td>
                <td>{d.itemCount || <span className="muted">0</span>}</td>
                <td>{d.wantedCount ? <Link href={`/dungeons/${d.id}`} className="badge gold">{d.wantedCount}</Link> : <span className="muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );

  const tabDungeons = dungeons.filter((d) => (game === 'retail') === (d.game === 'retail'));
  const q = search.trim().toLowerCase();
  const listed = q ? tabDungeons.filter((d) => d.name.toLowerCase().includes(q)) : tabDungeons;
  // "Needed now" cards: dungeons where someone needs something, tonight's run first
  const needed = tabDungeons
    .filter((d) => d.wantedCount || d.id === tonight?.dungeon_id)
    .sort((a, b) => (b.id === tonight?.dungeon_id) - (a.id === tonight?.dungeon_id) || b.wantedCount - a.wantedCount || b.people.length - a.people.length);

  return (
    <>
      <div className="row spread">
        <h1>Dungeons &amp; Raids</h1>
        <button className="btn ghost small" onClick={() => setShowAdd(!showAdd)}>{showAdd ? 'Cancel' : '+ Add dungeon'}</button>
      </div>
      <nav className="tabs game-tabs">
        <a href="#" className={game === 'classic' ? 'active' : ''} onClick={pickGame('classic')}>Classic</a>
        <a href="#" className={game === 'retail' ? 'active' : ''} onClick={pickGame('retail')}>Retail</a>
      </nav>
      {error && <p className="error">{error}</p>}
      {game === 'classic' && hasGameData === false && <ImportItems onDone={load} />}
      {game === 'classic' && needsGuides && <ImportGuides onDone={load} />}
      {game === 'classic' && hasGameData === null && (
        <section className="panel"><p className="muted">To get the automatic loot list, run <code>supabase/schema-3-auto-loot.sql</code> in Supabase first.</p></section>
      )}
      {game === 'retail' && tabDungeons.length === 0 && (
        <section className="panel">
          <h2>Retail dungeons &amp; raids</h2>
          <p className="muted">Load this season&apos;s Mythic+ dungeons and raids, with every boss and its loot, from Blizzard. Then open one and press <strong>Need</strong> on what you want.</p>
          <ImportRetail onDone={load} />
        </section>
      )}

      {showAdd && (
        <form onSubmit={addDungeon} className="panel stack">
          <div className="form-grid">
            <div><label htmlFor="dn">Name</label><input id="dn" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <label htmlFor="dk">Type</label>
              <select id="dk" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value, size: e.target.value === 'raid' ? (game === 'retail' ? 20 : 40) : 5 })}>
                <option value="dungeon">Dungeon</option><option value="raid">Raid</option>
              </select>
            </div>
            <div><label htmlFor="dmin">Min level</label><input id="dmin" type="number" value={form.min_level} onChange={(e) => setForm({ ...form, min_level: e.target.value })} /></div>
            <div><label htmlFor="dmax">Max level</label><input id="dmax" type="number" value={form.max_level} onChange={(e) => setForm({ ...form, max_level: e.target.value })} /></div>
            <div><label htmlFor="ds">Group size</label><input id="ds" type="number" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} /></div>
          </div>
          <button className="btn" type="submit">Add {game === 'retail' ? 'retail ' : ''}dungeon</button>
        </form>
      )}

      {/* ---------- Who needs what, right now ---------- */}
      {needed.length > 0 && !q && (
        <section className="panel">
          <h2>Needed now</h2>
          <p className="muted small" style={{ marginTop: 0 }}>Where people need loot. Open one to see who needs what, boss by boss.</p>
          <div className="dungeon-cards">
            {needed.map((d) => {
              const isTonight = d.id === tonight?.dungeon_id;
              return (
                <Link key={d.id} href={`/dungeons/${d.id}`} className={`dungeon-card ${isTonight ? 'tonight-card' : ''}`}>
                  <div className="row spread" style={{ flexWrap: 'nowrap' }}>
                    <strong className="dungeon-card-name">{d.name}</strong>
                    {isTonight ? <span className="badge gold">Tonight</span> : d.kind === 'raid' ? <span className="badge">Raid</span> : null}
                  </div>
                  <div className="muted small">
                    {d.wantedCount ? `${d.wantedCount} item${d.wantedCount === 1 ? '' : 's'} · ${d.people.length} ${d.people.length === 1 ? 'person' : 'people'}` : 'Nothing needed yet'}
                  </div>
                  {d.people.length > 0 && (
                    <div className="dungeon-card-people">
                      {d.people.slice(0, 5).map((c) => <span key={c.id} style={{ color: classColor(c.class) }}>{c.name}</span>)}
                      {d.people.length > 5 && <span className="muted small">+{d.people.length - 5}</span>}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {tabDungeons.length > 0 && (
        <div className="row" style={{ margin: '0.25rem 0 1rem' }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Find a ${game === 'retail' ? 'retail' : 'Classic'} dungeon or raid…`} style={{ maxWidth: 360 }} />
        </div>
      )}
      {listed.some((d) => d.kind === 'dungeon') && <Section title="Dungeons" list={listed.filter((d) => d.kind === 'dungeon')} />}
      {listed.some((d) => d.kind === 'raid') && <Section title="Raids" list={listed.filter((d) => d.kind === 'raid')} />}
      {q && listed.length === 0 && <section className="panel"><p className="muted">No dungeon by that name.</p></section>}

      {game === 'retail' && tabDungeons.length > 0 && (
        <details className="panel">
          <summary className="muted small" style={{ cursor: 'pointer' }}>New season? Re-load retail dungeons &amp; raids from Blizzard</summary>
          <ImportRetail onDone={load} />
        </details>
      )}
    </>
  );
}
