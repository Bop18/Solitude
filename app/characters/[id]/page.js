'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { specsOf } from '@/lib/specs';
import { itemsForLevels, loadDungeons } from '@/lib/suggest';
import { useAuth } from '@/components/AuthProvider';
import ItemName from '@/components/ItemName';
import ItemSearch from '@/components/ItemSearch';
import WantControl from '@/components/WantControl';
import LevelBar from '@/components/LevelBar';
import SyncGear from '@/components/SyncGear';
import RetailCharacter from '@/components/RetailCharacter';
import CharacterLogs from '@/components/CharacterLogs';
import { timeAgo } from '@/components/ActivityFeed';
import { GEAR_SLOTS, ITEM_SLOTS_FOR_GEAR, PRIORITY, ROLES, classColor, GAMES, gameOf, maxLevelFor, classesFor, racesFor } from '@/lib/wow';
import GameRealmFields from '@/components/GameRealmFields';
import { upgradeFor, statSummary, spreadAcrossSlots } from '@/lib/itemScore';

function gainLabel(u) {
  if (u.unknown) return '?';
  if (u.gain == null) return 'empty slot';
  return `+${Math.max(1, Math.round(u.gain * 100))}%`;
}

export default function CharacterPage() {
  const { id } = useParams();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const router = useRouter();

  const [char, setChar] = useState(null);
  const [gear, setGear] = useState({});          // slot -> row (with items)
  const [editingSlot, setEditingSlot] = useState(null);
  const [wishes, setWishes] = useState([]);
  const [received, setReceived] = useState([]);
  const [nearby, setNearby] = useState([]);      // dungeon items around this level
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [editForm, setEditForm] = useState(null); // null = not editing
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [c, g, w, h] = await Promise.all([
      supabase.from('characters').select('*, profiles(display_name)').eq('id', id).maybeSingle(),
      supabase.from('character_gear').select('*, items(*)').eq('character_id', id),
      supabase.from('wishlist').select('*, items(*, dungeons(id, name))').eq('character_id', id).order('obtained').order('priority'),
      supabase.from('loot_history').select('*, items(*), events(id, title)').eq('character_id', id).order('received_at', { ascending: false }).limit(30),
    ]);
    const err = c.error || g.error || w.error || h.error;
    if (err) setError(err.message);
    setChar(c.data);
    setGear(Object.fromEntries((g.data ?? []).map((row) => [row.slot, row])));
    setWishes(w.data ?? []);
    setReceived(h.data ?? []);

    // Dungeon loot around this character's level, for "Upgrades to look for"
    if (c.data) {
      const lvl = c.data.level;
      const [near, dungeons] = await Promise.all([itemsForLevels(Math.max(1, lvl - 2), lvl), loadDungeons()]);
      const byId = Object.fromEntries(dungeons.map((d) => [d.id, { id: d.id, name: d.name }]));
      setNearby(near
        .filter((i) => i.req_level == null || (i.req_level <= lvl + 2 && i.req_level >= lvl - 12))
        .map((i) => ({ ...i, dungeons: byId[i.dungeon_id] })));
    }
    setLoaded(true);
  }, [id]);

  useEffect(() => { if (userId) load(); }, [load, userId]);

  const suggestions = useMemo(() => {
    if (!char) return [];
    const have = new Set(received.map((r) => r.item_id));
    const ranked = nearby
      .filter((item) => !have.has(item.id))
      .map((item) => ({ item, u: upgradeFor(char, item, gear) }))
      .filter((x) => x.u && !x.u.unknown)
      .sort((a, b) => (b.u.gain ?? 0.6) - (a.u.gain ?? 0.6) || b.u.score - a.u.score);
    // Best 2 per slot, so it covers the whole character
    return spreadAcrossSlots(ranked, 2).slice(0, 12);
  }, [nearby, char, gear, received]);

  if (!loaded) return <p className="muted">Loading…</p>;
  if (!char) return <p>Character not found. <Link href="/roster">Back to roster</Link></p>;

  const isMine = char.owner === userId;

  // ---------- Gear ----------
  async function saveSlot(slot, item, freeText) {
    setError('');
    const { error } = await supabase.from('character_gear').upsert({
      character_id: Number(id),
      slot,
      item_name: item?.name ?? freeText,
      item_id: item?.id ?? null,
      updated_at: new Date().toISOString(),
    });
    if (error) return setError(error.message);
    // Was it on the Need list? Tick it off.
    if (item) {
      const wish = wishes.find((w) => w.item_id === item.id && !w.obtained);
      if (wish) await supabase.from('wishlist').update({ obtained: true }).eq('id', wish.id);
    }
    setEditingSlot(null);
    load();
  }

  async function clearSlot(slot) {
    const { error } = await supabase.from('character_gear').delete().match({ character_id: Number(id), slot });
    if (error) setError(error.message);
    load();
  }

  // ---------- Need list ----------
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

  async function gotIt(itemId) {
    // Recording it in loot history also ticks it off and posts to the feed
    const { error } = await supabase.from('loot_history').insert({ item_id: itemId, character_id: Number(id) });
    if (error) setError(error.message);
    load();
  }

  async function removeReceived(rowId) {
    const { error } = await supabase.from('loot_history').delete().eq('id', rowId);
    if (error) setError(error.message);
    load();
  }

  // ---------- Edit character ----------
  function startEdit() {
    setEditForm({
      name: char.name, game: gameOf(char), realm: char.realm ?? '', class: char.class, race: char.race ?? '',
      role: char.role ?? 'dps', spec: char.spec ?? '', level: char.level, is_main: char.is_main,
    });
  }
  const setField = (field) => (e) =>
    setEditForm({ ...editForm, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function saveEdit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    if (editForm.is_main && !char.is_main) {
      await supabase.from('characters').update({ is_main: false }).eq('owner', userId).neq('id', char.id);
    }
    const { error } = await supabase
      .from('characters')
      .update({
        name: editForm.name.trim(),
        realm: editForm.realm.trim() || null,
        ...(char.game !== undefined || editForm.game !== 'forever' ? { game: editForm.game } : {}),
        class: editForm.class,
        race: editForm.race || null,
        role: editForm.role,
        spec: specsOf(editForm.class).length && editForm.spec ? editForm.spec : null,
        level: Math.min(maxLevelFor(editForm), Math.max(1, Number(editForm.level) || 1)),
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
    if (!confirm(`Delete ${char.name}? Their gear, Need list and loot history will be deleted too.`)) return;
    const { error } = await supabase.from('characters').delete().eq('id', char.id);
    if (error) return setError(error.message);
    router.push('/roster');
  }

  const openWishes = wishes.filter((w) => !w.obtained);
  const filled = GEAR_SLOTS.filter((s) => gear[s]).length;
  const ilvls = GEAR_SLOTS.map((s) => gear[s]?.items?.ilvl).filter(Boolean);
  const avgIlvl = ilvls.length ? Math.round(ilvls.reduce((a, b) => a + b, 0) / ilvls.length) : null;
  const handTyped = GEAR_SLOTS.filter((s) => gear[s] && !gear[s].items).length;

  return (
    <>
      <p><Link href="/roster">← Roster</Link></p>
      <div className="row spread">
        <h1 style={{ color: classColor(char.class) }}>{char.name}</h1>
        {isMine && !editForm && <button className="btn ghost small" onClick={startEdit}>✎ Edit character</button>}
      </div>

      {isMine && editForm && (
        <form onSubmit={saveEdit} className="panel stack">
          <h2>Edit character</h2>
          <div className="form-grid">
            <div><label htmlFor="ename">Name</label><input id="ename" required value={editForm.name} onChange={setField('name')} /></div>
            <GameRealmFields idPrefix="e" value={editForm} onChange={(patch) => setEditForm((f) => {
              const next = { ...f, ...patch };
              if (!classesFor(next.game).includes(next.class)) next.class = 'Warrior';
              if (next.race && !racesFor(next.game).includes(next.race)) next.race = '';
              return next;
            })} />
            <div>
              <label htmlFor="eclass">Class</label>
              <select id="eclass" value={editForm.class} onChange={(e) => setEditForm((f) => ({ ...f, class: e.target.value, spec: '' }))}>
                {!classesFor(editForm.game).includes(editForm.class) && <option>{editForm.class}</option>}
                {classesFor(editForm.game).map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="erace">Race</label>
              <select id="erace" value={editForm.race} onChange={setField('race')}>
                <option value="">—</option>
                {editForm.race && !racesFor(editForm.game).includes(editForm.race) && <option>{editForm.race}</option>}
                {racesFor(editForm.game).map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            {specsOf(editForm.class).length > 0 && (
              <div>
                <label htmlFor="espec">Spec</label>
                <select id="espec" value={editForm.spec}
                  onChange={(e) => { const sp = specsOf(editForm.class).find((x) => x.id === e.target.value); setEditForm((f) => ({ ...f, spec: e.target.value, role: sp?.role ?? f.role })); }}>
                  <option value="">Not sure yet</option>
                  {specsOf(editForm.class).map((sp) => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label htmlFor="erole">Role{editForm.spec ? ' (from spec)' : ''}</label>
              <select id="erole" value={editForm.role} onChange={setField('role')} disabled={!!editForm.spec}>
                {Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
              </select>
            </div>
            <div><label htmlFor="elevel">Level</label><input id="elevel" type="number" min={1} max={maxLevelFor(editForm)} value={editForm.level} onChange={setField('level')} /></div>
          </div>
          <label className="checkbox"><input type="checkbox" checked={editForm.is_main} onChange={setField('is_main')} /> This is my main</label>
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
        {char.race ? `${char.race} ` : ''}{char.spec ? `${specsOf(char.class).find((x) => x.id === char.spec)?.name ?? ''} ` : ''}{char.class}
        {char.role ? ` · ${ROLES[char.role].label}` : ''}
        {` · ${GAMES[gameOf(char)].label}`}{char.realm ? ` · ${char.realm}` : ''} · played by {char.profiles?.display_name}
      </p>
      <div style={{ maxWidth: 320, marginBottom: '1.25rem' }}><LevelBar level={char.level} className={char.class} max={maxLevelFor(char)} /></div>
      {error && <p className="error">{error}</p>}

      {gameOf(char) === 'retail' ? <RetailCharacter character={char} /> : (<>
      {/* ---------- Upgrades to look for ---------- */}
      <section className="panel">
        <h2>Upgrades to look for</h2>
        <p className="muted small">
          The best dungeon drops for a level {char.level} {char.class}, compared with the gear below.
          {filled === 0 && isMine && ' Fill in your gear for better suggestions. Right now every slot counts as empty.'}
          {handTyped > 0 && ` ${handTyped} slot${handTyped === 1 ? ' was' : 's were'} typed by hand, so ${handTyped === 1 ? 'it' : 'they'} can't be compared. Pick from the search list instead.`}
        </p>
        {suggestions.length === 0 ? (
          <p className="muted">No dungeon upgrades found around level {char.level}. {nearby.length === 0 && 'Has the Classic loot list been loaded on the Dungeons page?'}</p>
        ) : (
          <div className="table-wrap">
            <table className="loot-table">
              <thead><tr><th>Item</th><th>Gain</th><th>Where</th><th></th></tr></thead>
              <tbody>
                {suggestions.map(({ item, u }) => (
                  <tr key={item.id}>
                    <td className="item-cell">
                      <ItemName item={item} />
                      <div className="muted small">{item.slot}{item.req_level ? ` · req ${item.req_level}` : ''}{u.replaces ? ` · replaces ${u.replaces.name}` : ''}</div>
                      {statSummary(item) && <div className="stat-line">{statSummary(item)}</div>}
                    </td>
                    <td><span className={`gain ${u.gain == null ? 'gain-soft' : ''}`}>{gainLabel(u)}</span></td>
                    <td>
                      <Link href={`/dungeons/${item.dungeons.id}`}>{item.dungeons.name}</Link>
                      <div className="muted small">{item.boss ?? item.notes ?? 'Trash'}{item.drop_chance ? ` · ${item.drop_chance}%` : ''}</div>
                    </td>
                    <td className="actions-cell">
                      {isMine && (
                        <WantControl itemId={item.id} wanters={wishes.filter((w) => w.item_id === item.id && !w.obtained)} charId={char.id} onChanged={load} onError={setError} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid-2">
        {/* ---------- Gear ---------- */}
        <section className="panel">
          <div className="row spread">
            <h2>Gear</h2>
            <span className="muted small">
              {avgIlvl ? <><strong className="ilvl-big">{avgIlvl}</strong> avg item level · </> : null}
              {filled}/{GEAR_SLOTS.length} slots
            </span>
          </div>
          {isMine && <SyncGear character={char} onSynced={load} />}
          {!isMine && char.synced_at && (
            <p className="muted small">Synced from the game {timeAgo(char.synced_at)}</p>
          )}
          {isMine && <p className="muted small">Or set slots yourself: click Add and pick from the list so the site knows the stats.</p>}
          <table className="gear-table">
            <tbody>
              {GEAR_SLOTS.map((slot) => {
                const row = gear[slot];
                const editing = editingSlot === slot;
                return (
                  <tr key={slot}>
                    <td className="muted small" style={{ width: 90 }}>{slot}</td>
                    <td>
                      {isMine && editing ? (
                        <div className="row" style={{ flexWrap: 'nowrap' }}>
                          <ItemSearch
                            slots={ITEM_SLOTS_FOR_GEAR[slot] ?? [slot]}
                            onPick={(item) => saveSlot(slot, item)}
                            onFreeText={(text) => saveSlot(slot, null, text)}
                            onCancel={() => setEditingSlot(null)}
                          />
                          <button className="btn ghost small" onClick={() => setEditingSlot(null)} aria-label="Cancel">✕</button>
                        </div>
                      ) : row ? (
                        <div className="gear-item">
                          <ItemName item={row.items ?? { name: row.item_name, quality: 'common' }} />
                          {row.items?.ilvl ? <span className="ilvl" title="Item level">{row.items.ilvl}</span> : null}
                          {!row.items && <span className="muted small" title="Typed by hand, so its stats aren't known"> ?</span>}
                          {row.items && statSummary(row.items) && <div className="stat-line">{statSummary(row.items)}</div>}
                        </div>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    {isMine && !editing && (
                      <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                        <button className="btn ghost small" onClick={() => setEditingSlot(slot)}>{row ? 'Change' : 'Add'}</button>
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

        <div>
          {/* ---------- Need list ---------- */}
          <section className="panel">
            <h2>Needs</h2>
            {openWishes.length === 0 && (
              <p className="muted">
                Nothing needed yet.{isMine && <> Hit <strong>Need</strong> on an upgrade above, or browse a <Link href="/dungeons">dungeon</Link>.</>}
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
                    </div>
                  </div>
                  {isMine ? (
                    <div className="row">
                      <select value={w.priority} onChange={(e) => updateWish(w.id, { priority: Number(e.target.value) })} style={{ width: 'auto' }} aria-label="Priority">
                        {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                      <button className="btn small" onClick={() => gotIt(w.item_id)}>Got it!</button>
                      <button className="btn ghost small" onClick={() => removeWish(w.id)} aria-label="Remove">✕</button>
                    </div>
                  ) : (
                    <span className={`prio prio-${w.priority}`}>{PRIORITY[w.priority]}</span>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* ---------- Loot received ---------- */}
          <section className="panel">
            <h2>Loot received</h2>
            {received.length === 0 ? (
              <p className="muted">Nothing recorded yet.</p>
            ) : (
              <div className="stack">
                {received.map((r) => (
                  <div key={r.id} className="row spread">
                    <div>
                      <ItemName item={r.items} />
                      <div className="muted small">
                        {new Date(r.received_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                        {r.events && <> · <Link href={`/events/${r.events.id}`}>{r.events.title}</Link></>}
                      </div>
                    </div>
                    {(isMine || r.recorded_by === userId) && (
                      <button className="btn ghost small" onClick={() => removeReceived(r.id)} title="Remove this record">✕</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
      </>)}

      <CharacterLogs character={char} />
    </>
  );
}
