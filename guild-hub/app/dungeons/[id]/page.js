'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import ItemName from '@/components/ItemName';
import WantControl from '@/components/WantControl';
import RecordLoot from '@/components/RecordLoot';
import ImportItems from '@/components/ImportItems';
import { CLASS_NAMES, ITEM_SLOTS, QUALITY, PRIORITY, classColor } from '@/lib/wow';
import { bestFor, upgradeFor, statSummary, spreadAcrossSlots } from '@/lib/itemScore';

const EMPTY_ITEM = { name: '', boss: '', slot: '', item_type: '', quality: 'rare', classes: [], link: '', notes: '' };
const TRASH = 'Trash & other drops';

function gainLabel(u) {
  if (u.unknown) return '?';
  if (u.gain == null) return 'empty slot';
  return `+${Math.max(1, Math.round(u.gain * 100))}%`;
}

export default function DungeonPage() {
  const { id } = useParams();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [dungeon, setDungeon] = useState(null);
  const [items, setItems] = useState([]);
  const [wishes, setWishes] = useState([]);
  const [history, setHistory] = useState([]);
  const [roster, setRoster] = useState([]);
  const [wantAs, setWantAs] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [onlyUpgrades, setOnlyUpgrades] = useState(false);
  const [form, setForm] = useState(EMPTY_ITEM);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [hasGameData, setHasGameData] = useState(true);

  const load = useCallback(async () => {
    const [d, it, ch, gd] = await Promise.all([
      supabase.from('dungeons').select('*').eq('id', id).maybeSingle(),
      supabase.from('items').select('*').eq('dungeon_id', id).order('ilvl', { ascending: false, nullsFirst: false }),
      supabase
        .from('characters')
        .select('id, name, class, level, owner, is_main, profiles(display_name), character_gear(slot, item_name, items(*))')
        .order('level', { ascending: false }),
      supabase.from('items').select('id', { count: 'exact', head: true }).not('game_id', 'is', null),
    ]);
    const err = d.error || it.error || ch.error;
    if (err) setError(err.message);
    setDungeon(d.data);
    setItems(it.data ?? []);
    setRoster(ch.data ?? []);
    setHasGameData((gd.count ?? 0) > 0);

    const mine = (ch.data ?? []).filter((c) => c.owner === userId).sort((a, b) => b.is_main - a.is_main);
    setWantAs((cur) => cur || String(mine[0]?.id ?? ''));

    const ids = (it.data ?? []).map((i) => i.id);
    if (ids.length) {
      const [w, h] = await Promise.all([
        supabase.from('wishlist').select('*, characters(id, name, class, owner)').in('item_id', ids).eq('obtained', false),
        supabase.from('loot_history').select('item_id, character_id').in('item_id', ids),
      ]);
      if (w.error || h.error) setError((w.error || h.error).message);
      setWishes(w.data ?? []);
      setHistory(h.data ?? []);
    } else {
      setWishes([]);
      setHistory([]);
    }
    setLoaded(true);
  }, [id, userId]);

  useEffect(() => { if (userId) load(); }, [load, userId]);

  // Gear by character: { charId: { slot: row } }
  const gearOf = useMemo(() => {
    const map = {};
    for (const c of roster) map[c.id] = Object.fromEntries((c.character_gear ?? []).map((g) => [g.slot, g]));
    return map;
  }, [roster]);

  const gotIt = useMemo(() => new Set(history.map((h) => `${h.item_id}-${h.character_id}`)), [history]);

  // For every item: which characters in the group it's an upgrade for
  const upgrades = useMemo(() => {
    const out = {};
    for (const item of items) {
      const list = [];
      for (const c of roster) {
        if (gotIt.has(`${item.id}-${c.id}`)) continue;
        if (item.req_level && item.req_level > c.level + 2) continue; // too high level for now
        const gear = gearOf[c.id] ?? {};
        const u = upgradeFor(c, item, gear);
        if (!u) continue;
        // Way over-levelled with nothing entered in that slot? They surely have better.
        if (u.gain == null && !u.unknown && item.req_level && c.level > item.req_level + 15) continue;
        list.push({ char: c, ...u });
      }
      out[item.id] = list;
    }
    return out;
  }, [items, roster, gearOf, gotIt]);

  if (!loaded) return <p className="muted">Loading…</p>;
  if (!dungeon) return <p>Dungeon not found. <Link href="/dungeons">Back</Link></p>;

  const myChars = roster.filter((c) => c.owner === userId);
  const me = roster.find((c) => String(c.id) === wantAs);
  const wantersOf = (itemId) => wishes.filter((w) => w.item_id === itemId);
  const iHave = (item) =>
    !!me && (gotIt.has(`${item.id}-${me.id}`) || Object.values(gearOf[me.id] ?? {}).some((g) => g.items?.id === item.id));

  // "For your group": each character's best finds here
  const groupFinds = roster
    .map((c) => {
      const finds = items
        .map((item) => ({ item, u: upgrades[item.id]?.find((x) => x.char.id === c.id) }))
        .filter((x) => x.u)
        .sort((a, b) =>
          (b.u.unknown ? -1 : b.u.gain ?? 0.6) - (a.u.unknown ? -1 : a.u.gain ?? 0.6) || b.u.score - a.u.score);
      const top = spreadAcrossSlots(finds, 1);
      return { char: c, finds: [...top, ...finds.filter((f) => !top.includes(f))] };
    })
    .filter((g) => g.finds.length)
    .sort((a, b) => (b.char.owner === userId) - (a.char.owner === userId) || b.finds.length - a.finds.length);
  const nothingFor = roster.filter((c) => !groupFinds.some((g) => g.char.id === c.id));

  // Filters
  let shown = items;
  if (classFilter) shown = shown.filter((i) => bestFor(i).includes(classFilter) || i.classes?.includes(classFilter));
  if (onlyUpgrades && me) shown = shown.filter((i) => upgrades[i.id]?.some((u) => u.char.id === me.id));

  // Group by boss, roughly in dungeon order (lower item level first), trash last
  const byBoss = {};
  for (const item of shown) (byBoss[item.boss || TRASH] ??= []).push(item);
  const bossOrder = Object.keys(byBoss).sort((a, b) => {
    if (a === TRASH) return 1;
    if (b === TRASH) return -1;
    const avg = (k) => byBoss[k].reduce((s, i) => s + (i.ilvl ?? 0), 0) / byBoss[k].length;
    return avg(a) - avg(b);
  });

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

  return (
    <>
      <p><Link href="/dungeons">← All dungeons</Link></p>
      <h1>{dungeon.name}</h1>
      <p className="muted">
        {dungeon.kind === 'raid' ? 'Raid' : 'Dungeon'}
        {dungeon.min_level ? ` · levels ${dungeon.min_level}–${dungeon.max_level ?? '?'}` : ''} · {dungeon.size}-player · {items.length} items
      </p>
      {error && <p className="error">{error}</p>}

      {!hasGameData && <ImportItems onDone={load} />}

      {/* ---------- For your group ---------- */}
      {hasGameData && (
        <section className="panel">
          <h2>For your group</h2>
          <p className="muted small">
            Upgrades here for each character, compared with the gear they&apos;ve entered on their character page.
            &quot;Empty slot&quot; means nothing&apos;s entered for that slot yet; &quot;?&quot; means their current item was typed in by hand, so it can&apos;t be compared.
          </p>
          {groupFinds.length === 0 ? (
            <p className="muted">No upgrades here for anyone in the group at their current levels.</p>
          ) : (
            <div className="group-finds">
              {groupFinds.map(({ char, finds }) => (
                <div key={char.id} className="group-find">
                  <div className="group-find-head">
                    <Link href={`/characters/${char.id}`} style={{ color: classColor(char.class), fontWeight: 600 }}>{char.name}</Link>
                    <span className="muted small">{char.level} {char.class}{char.owner !== userId && char.profiles ? ` · ${char.profiles.display_name}` : ''}</span>
                  </div>
                  <div className="find-list">
                    {finds.slice(0, 4).map(({ item, u }) => (
                      <div key={item.id} className="find">
                        <ItemName item={item} />
                        <span className={`gain ${u.gain == null || u.unknown ? 'gain-soft' : ''}`}>{gainLabel(u)}</span>
                      </div>
                    ))}
                    {finds.length > 4 && <span className="muted small">+{finds.length - 4} more below</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {nothingFor.length > 0 && groupFinds.length > 0 && (
            <p className="muted small" style={{ marginTop: '0.75rem' }}>Nothing here for: {nothingFor.map((c) => c.name).join(', ')}</p>
          )}
        </section>
      )}

      {/* ---------- Filters ---------- */}
      <section className="panel filters">
        <div className="row">
          <label htmlFor="cf" style={{ margin: 0 }}>Best for</label>
          <select id="cf" value={classFilter} onChange={(e) => setClassFilter(e.target.value)} style={{ width: 'auto' }}>
            <option value="">All classes</option>
            {CLASS_NAMES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        {myChars.length > 0 && (
          <div className="row">
            <label htmlFor="wa" style={{ margin: 0 }}>Needing as</label>
            <select id="wa" value={wantAs} onChange={(e) => setWantAs(e.target.value)} style={{ width: 'auto' }}>
              {myChars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <label className="checkbox" style={{ margin: 0 }}>
              <input type="checkbox" checked={onlyUpgrades} onChange={(e) => setOnlyUpgrades(e.target.checked)} /> Only upgrades for {me?.name ?? 'me'}
            </label>
          </div>
        )}
      </section>

      {shown.length === 0 && (
        <section className="panel">
          <p className="muted">
            {items.length === 0
              ? 'No items for this dungeon yet.'
              : onlyUpgrades ? `Nothing here is an upgrade for ${me?.name}.` : `No items here are best for ${classFilter}.`}
          </p>
        </section>
      )}

      {/* ---------- Loot by boss ---------- */}
      {bossOrder.map((boss) => (
        <section className="panel" key={boss}>
          <h2>{boss}</h2>
          <div className="table-wrap">
            <table className="loot-table">
              <thead>
                <tr><th>Item</th><th>Best for</th><th>Upgrade for</th><th>Needed by</th><th></th></tr>
              </thead>
              <tbody>
                {byBoss[boss].map((item) => {
                  const wanters = wantersOf(item.id);
                  const best = item.game_id ? bestFor(item) : item.classes ?? [];
                  const ups = upgrades[item.id] ?? [];
                  return (
                    <tr key={item.id}>
                      <td className="item-cell">
                        <ItemName item={item} />
                        <div className="muted small">
                          {[item.slot, item.item_type !== 'Miscellaneous' && item.item_type].filter(Boolean).join(' · ')}
                          {item.req_level ? ` · req ${item.req_level}` : ''}
                          {item.drop_chance ? ` · ${item.drop_chance}% drop` : ''}
                        </div>
                        {statSummary(item) && <div className="stat-line">{statSummary(item)}</div>}
                        {item.notes && <div className="muted small">{item.notes}</div>}
                      </td>
                      <td>
                        {best.length === 0 ? (
                          <span className="muted small" title="Its value is a special effect. Hover the item name for details.">Special effect</span>
                        ) : (
                          <div className="chips">
                            {best.slice(0, 5).map((c) => (
                              <span key={c} className="class-chip" style={{ color: classColor(c) }}>{c}</span>
                            ))}
                            {best.length > 5 && <span className="muted small">+{best.length - 5}</span>}
                          </div>
                        )}
                      </td>
                      <td>
                        {ups.length === 0 ? <span className="muted">—</span> : (
                          <div className="wanters">
                            {ups.slice(0, 4).map((u) => (
                              <span key={u.char.id} className="wanter">
                                <Link href={`/characters/${u.char.id}`} style={{ color: classColor(u.char.class) }}>{u.char.name}</Link>
                                <span className={`gain ${u.gain == null || u.unknown ? 'gain-soft' : ''}`}>{gainLabel(u)}</span>
                              </span>
                            ))}
                            {ups.length > 4 && <span className="muted small">+{ups.length - 4} more</span>}
                          </div>
                        )}
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
                      <td className="actions-cell">
                        <WantControl itemId={item.id} wanters={wanters} charId={wantAs} have={iHave(item)} onChanged={load} onError={setError} />
                        <RecordLoot
                          itemId={item.id}
                          roster={roster}
                          suggestedIds={wanters.map((w) => w.character_id)}
                          onDone={load}
                          onError={setError}
                        />
                        {!item.game_id && item.created_by === userId && (
                          <button className="btn danger small" onClick={() => deleteItem(item)} aria-label="Delete item">✕</button>
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

      {/* ---------- Custom items (e.g. new WoW: Forever loot) ---------- */}
      <section className="panel">
        <div className="row spread">
          <div>
            <h2 style={{ marginBottom: 0 }}>Add a missing item</h2>
            <p className="muted small" style={{ margin: 0 }}>For new WoW: Forever loot that isn&apos;t in the Classic list.</p>
          </div>
          <div className="row">
            {hasGameData && <ImportItems compact onDone={load} />}
            <button className="btn ghost small" onClick={() => setShowAdd(!showAdd)}>{showAdd ? 'Hide' : 'Show form'}</button>
          </div>
        </div>
        {showAdd && (
          <form onSubmit={addItem} className="stack" style={{ marginTop: '1rem' }}>
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
            <div><label htmlFor="inotes">Notes</label><input id="inotes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <button className="btn" type="submit">Add item</button>
          </form>
        )}
      </section>
    </>
  );
}
