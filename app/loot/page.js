'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import ItemName from '@/components/ItemName';
import WantControl from '@/components/WantControl';
import RecordLoot from '@/components/RecordLoot';
import LootTabs from '@/components/LootTabs';
import ImportRetail from '@/components/ImportRetail';
import { PRIORITY, classColor } from '@/lib/wow';

const TRASH = 'Trash & other drops';
const isRetailChar = (c) => c.game === 'retail';

// Loot: Classic / Retail → dungeon cards (who needs things where) → open one to see
// who needs what from it, boss by boss. Handy to keep open while you play.
export default function LootPage() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [game, setGame] = useState('classic');
  const [sel, setSel] = useState(null); // dungeon id
  const [wishes, setWishes] = useState([]);
  const [dungeons, setDungeons] = useState([]);
  const [roster, setRoster] = useState([]);
  const [tonight, setTonight] = useState(null);
  const [wantAs, setWantAs] = useState({}); // game → character id
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  // ?game=retail&dungeon=12
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('game') === 'retail') setGame('retail');
    if (q.get('dungeon')) setSel(Number(q.get('dungeon')));
  }, []);
  const go = (g, d) => {
    setGame(g);
    setSel(d);
    const q = new URLSearchParams();
    if (g === 'retail') q.set('game', 'retail');
    if (d) q.set('dungeon', String(d));
    window.history.replaceState(null, '', `${window.location.pathname}${q.toString() ? `?${q}` : ''}`);
    window.scrollTo({ top: 0 });
  };

  const load = useCallback(async () => {
    const soon = new Date(Date.now() + 14 * 3600e3).toISOString();
    const recent = new Date(Date.now() - 3 * 3600e3).toISOString();
    const [w, d, ch, ev] = await Promise.all([
      supabase.from('wishlist')
        .select('*, items(*), characters(id, name, class, level, owner, profiles(display_name))')
        .eq('obtained', false).order('priority'),
      supabase.from('dungeons').select('*').order('min_level', { nullsFirst: false }),
      supabase.from('characters').select('*').order('name'),
      supabase.from('events').select('id, title, starts_at, dungeon_id').not('dungeon_id', 'is', null)
        .gte('starts_at', recent).lte('starts_at', soon).order('starts_at').limit(1),
    ]);
    const err = w.error || d.error || ch.error;
    if (err) setError(err.message);
    setWishes(w.data ?? []);
    setDungeons(d.data ?? []);
    setRoster(ch.data ?? []);
    setTonight(ev.data?.[0] ?? null);
    setLoaded(true);
  }, []);

  useEffect(() => { if (userId) load(); }, [load, userId]);

  const dungeonById = useMemo(() => Object.fromEntries(dungeons.map((x) => [x.id, x])), [dungeons]);
  const gameOfDungeon = (d) => (d?.game === 'retail' ? 'retail' : 'classic');
  const tabRoster = roster.filter((c) => (game === 'retail') === isRetailChar(c));
  const myChars = tabRoster.filter((c) => c.owner === userId).sort((a, b) => b.is_main - a.is_main || b.level - a.level);
  const me = String(wantAs[game] ?? myChars[0]?.id ?? '');

  // Needs per dungeon (this tab only)
  const needsByDungeon = {};
  for (const w of wishes) {
    const d = dungeonById[w.items?.dungeon_id];
    if (!d || gameOfDungeon(d) !== game) continue;
    (needsByDungeon[d.id] ??= []).push(w);
  }

  const tabSwitch = (
    <nav className="tabs game-tabs">
      <a href="#" className={game === 'classic' ? 'active' : ''} onClick={(e) => { e.preventDefault(); go('classic', null); }}>Classic</a>
      <a href="#" className={game === 'retail' ? 'active' : ''} onClick={(e) => { e.preventDefault(); go('retail', null); }}>Retail</a>
    </nav>
  );

  const header = (
    <>
      <div className="row spread">
        <h1>Loot</h1>
        {myChars.length > 1 && (
          <div className="row">
            <label htmlFor="wa" style={{ margin: 0 }}>Needing as</label>
            <select id="wa" value={me} onChange={(e) => setWantAs((x) => ({ ...x, [game]: e.target.value }))} style={{ width: 'auto' }}>
              {myChars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
      </div>
      <LootTabs />
      {tabSwitch}
      {error && <p className="error">{error}</p>}
    </>
  );

  if (!loaded) return <>{header}<p className="muted">Loading…</p></>;

  const selected = sel ? dungeonById[sel] : null;
  if (selected) {
    return (
      <>
        {header}
        <DungeonNeeds
          dungeon={selected}
          needs={needsByDungeon[selected.id] ?? []}
          roster={tabRoster}
          me={me}
          userId={userId}
          isTonight={tonight?.dungeon_id === selected.id}
          onBack={() => go(game, null)}
          onChanged={load}
          onError={setError}
        />
      </>
    );
  }

  // ---------- Dungeon cards ----------
  const tabDungeons = dungeons.filter((d) => gameOfDungeon(d) === game);
  const q = search.trim().toLowerCase();
  let cards = tabDungeons.filter((d) => (q ? d.name.toLowerCase().includes(q) : game === 'retail' || needsByDungeon[d.id]?.length));
  const tonightDungeon = tonight && dungeonById[tonight.dungeon_id];
  if (tonightDungeon && gameOfDungeon(tonightDungeon) === game && !cards.includes(tonightDungeon)) cards = [tonightDungeon, ...cards];
  cards.sort((a, b) =>
    (b.id === tonight?.dungeon_id) - (a.id === tonight?.dungeon_id)
    || (needsByDungeon[b.id]?.length ?? 0) - (needsByDungeon[a.id]?.length ?? 0)
    || (a.kind === 'raid') - (b.kind === 'raid')
    || a.name.localeCompare(b.name));

  return (
    <>
      {header}
      <div className="row" style={{ marginBottom: '1rem' }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Find a ${game === 'retail' ? 'retail' : 'Classic'} dungeon or raid…`} style={{ maxWidth: 360 }} />
      </div>

      {game === 'retail' && tabDungeons.length === 0 && (
        <section className="panel">
          <h2>Retail dungeons &amp; raids</h2>
          <p className="muted">Load this season&apos;s Mythic+ dungeons and raids, with every boss and its loot, from Blizzard. Then open one and press <strong>Need</strong> on what you want.</p>
          <ImportRetail onDone={load} />
        </section>
      )}

      {cards.length === 0 && !(game === 'retail' && tabDungeons.length === 0) && (
        <section className="panel">
          <p className="muted">
            {q ? 'No dungeon by that name.' : <>Nobody needs anything here yet. Search for a dungeon above, open it, and press <strong>Need</strong> on what you want.</>}
          </p>
        </section>
      )}

      <div className="dungeon-cards">
        {cards.map((d) => {
          const needs = needsByDungeon[d.id] ?? [];
          const people = [...new Map(needs.map((w) => [w.characters?.id, w.characters])).values()].filter(Boolean);
          const items = new Set(needs.map((w) => w.item_id)).size;
          const isTonight = d.id === tonight?.dungeon_id;
          return (
            <button key={d.id} className={`dungeon-card ${isTonight ? 'tonight-card' : ''}`} onClick={() => go(game, d.id)}>
              <div className="row spread" style={{ flexWrap: 'nowrap' }}>
                <strong className="dungeon-card-name">{d.name}</strong>
                {isTonight ? <span className="badge gold">Tonight</span> : d.kind === 'raid' ? <span className="badge">Raid</span> : null}
              </div>
              <div className="muted small">
                {items ? `${items} item${items === 1 ? '' : 's'} · ${people.length} ${people.length === 1 ? 'person' : 'people'}` : 'Nothing needed yet'}
                {d.min_level && game === 'classic' ? ` · lvl ${d.min_level}${d.max_level ? `–${d.max_level}` : ''}` : ''}
              </div>
              {people.length > 0 && (
                <div className="dungeon-card-people">
                  {people.slice(0, 5).map((c) => <span key={c.id} style={{ color: classColor(c.class) }}>{c.name}</span>)}
                  {people.length > 5 && <span className="muted small">+{people.length - 5}</span>}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {game === 'retail' && tabDungeons.length > 0 && (
        <details className="panel" style={{ marginTop: '1.25rem' }}>
          <summary className="muted small" style={{ cursor: 'pointer' }}>New season? Re-load retail dungeons &amp; raids from Blizzard</summary>
          <ImportRetail onDone={load} />
        </details>
      )}
    </>
  );
}

// ---------- One dungeon: who needs what, boss by boss ----------
function DungeonNeeds({ dungeon, needs, roster, me, userId, isTonight, onBack, onChanged, onError }) {
  const [allLoot, setAllLoot] = useState(needs.length === 0);
  const [justMine, setJustMine] = useState(false);
  const [items, setItems] = useState(null);

  useEffect(() => {
    if (!allLoot || items) return;
    supabase.from('items').select('*').eq('dungeon_id', dungeon.id).then(({ data }) => setItems(data ?? []));
  }, [allLoot, items, dungeon.id]);

  // item id → { item, wanters }
  const rows = {};
  for (const w of needs) {
    if (justMine && w.characters?.owner !== userId) continue;
    (rows[w.item_id] ??= { item: w.items, wanters: [] }).wanters.push(w);
  }
  if (allLoot && !justMine) for (const it of items ?? []) rows[it.id] ??= { item: it, wanters: [] };

  // Group by boss, in kill order
  const byBoss = {};
  for (const r of Object.values(rows)) (byBoss[r.item.boss || TRASH] ??= []).push(r);
  const orderOf = (boss) => {
    const list = byBoss[boss];
    const o = list.find((r) => r.item.boss_order != null)?.item.boss_order;
    if (o != null) return o;
    return list.reduce((s, r) => s + (r.item.ilvl ?? 0), 0) / list.length; // Classic: lower item level ≈ earlier boss
  };
  const bosses = Object.keys(byBoss).sort((a, b) => (a === TRASH) - (b === TRASH) || orderOf(a) - orderOf(b));
  const neededCount = new Set(needs.map((w) => w.item_id)).size;

  return (
    <>
      <div className="row spread" style={{ marginBottom: '0.75rem' }}>
        <button className="btn ghost small" onClick={onBack}>← All {dungeon.game === 'retail' ? 'retail' : 'Classic'} dungeons</button>
        {dungeon.game !== 'retail' && <Link className="small" href={`/dungeons/${dungeon.id}`}>Guide, tactics &amp; full loot table →</Link>}
      </div>
      <section className={`panel ${isTonight ? 'tonight-panel' : ''}`}>
        <div className="row spread">
          <h2 style={{ margin: 0 }}>
            {dungeon.name} {isTonight && <span className="badge gold">Tonight</span>} {dungeon.kind === 'raid' && <span className="badge">Raid</span>}
          </h2>
          <span className="muted small">{neededCount} item{neededCount === 1 ? '' : 's'} needed</span>
        </div>
        <div className="row" style={{ marginTop: '0.6rem' }}>
          <label className="checkbox" style={{ margin: 0 }}><input type="checkbox" checked={justMine} onChange={(e) => setJustMine(e.target.checked)} /> Just mine</label>
          <label className="checkbox" style={{ margin: 0 }}><input type="checkbox" checked={allLoot} onChange={(e) => setAllLoot(e.target.checked)} /> Show all loot (to add needs)</label>
        </div>
      </section>

      {allLoot && items === null && <p className="muted">Loading loot…</p>}
      {bosses.length === 0 && (allLoot ? items !== null : true) && (
        <section className="panel"><p className="muted">{justMine ? 'You don’t need anything from here.' : allLoot ? 'No loot listed for this one yet.' : 'Nobody needs anything from here yet. Tick “Show all loot” to add a need.'}</p></section>
      )}

      {bosses.map((boss) => (
        <section className="panel" key={boss}>
          <h2>{boss}</h2>
          <div className="table-wrap">
            <table className="loot-table">
              <thead><tr><th>Item</th><th>Needed by</th><th></th></tr></thead>
              <tbody>
                {byBoss[boss]
                  .sort((a, b) => b.wanters.length - a.wanters.length || (b.item.ilvl ?? 0) - (a.item.ilvl ?? 0))
                  .map(({ item, wanters }) => (
                    <tr key={item.id} className={wanters.length ? '' : 'unneeded'}>
                      <td className="item-cell">
                        <ItemName item={item} />
                        <div className="muted small">{[item.slot, item.item_type !== 'Miscellaneous' && item.item_type, item.ilvl && `ilvl ${item.ilvl}`].filter(Boolean).join(' · ')}</div>
                      </td>
                      <td>
                        {wanters.length === 0 ? <span className="muted">—</span> : (
                          <div className="wanters">
                            {[...wanters].sort((a, b) => a.priority - b.priority).map((w) => (
                              <span key={w.id} className="wanter">
                                <Link href={`/characters/${w.characters.id}`} style={{ color: classColor(w.characters.class) }}>{w.characters.name}</Link>
                                <span className="muted small">{w.characters.profiles?.display_name}</span>
                                <span className={`prio prio-${w.priority}`}>{PRIORITY[w.priority]}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="actions-cell">
                        {me && <WantControl itemId={item.id} wanters={wanters} charId={me} onChanged={onChanged} onError={onError} />}
                        {wanters.length > 0 && <RecordLoot itemId={item.id} roster={roster} suggestedIds={wanters.map((w) => w.character_id)} onDone={onChanged} onError={onError} />}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}
