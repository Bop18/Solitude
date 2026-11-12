'use client';

import Link from 'next/link';
import ItemName from './ItemName';
import WantControl from './WantControl';
import RecordLoot from './RecordLoot';
import { PRIORITY, classColor } from '@/lib/wow';

const TRASH = 'Trash & other drops';

/**
 * A dungeon's loot, boss by boss in kill order: what each boss drops (or just what's needed),
 * who needs it, and Need / Looted buttons. Used for the "Needed" view and for retail's loot table.
 * items: the dungeon's items · wishes: open needs for them (with characters) · roster: characters for Looted
 */
export default function BossLoot({ items, wishes, roster, wantAs, userId, showAll = false, justMine = false, onChanged, onError, emptyText }) {
  const wantersOf = {};
  for (const w of wishes) {
    if (justMine && w.characters?.owner !== userId) continue;
    (wantersOf[w.item_id] ??= []).push(w);
  }
  const rows = items
    .filter((it) => (showAll && !justMine) || wantersOf[it.id]?.length)
    .map((item) => ({ item, wanters: wantersOf[item.id] ?? [] }));

  // Group by boss, in kill order
  const byBoss = {};
  for (const r of rows) (byBoss[r.item.boss || TRASH] ??= []).push(r);
  const orderOf = (boss) => {
    const list = byBoss[boss];
    const o = list.find((r) => r.item.boss_order != null)?.item.boss_order;
    if (o != null) return o;
    return list.reduce((s, r) => s + (r.item.ilvl ?? 0), 0) / list.length; // Classic: lower item level ≈ earlier boss
  };
  const bosses = Object.keys(byBoss).sort((a, b) => (a === TRASH) - (b === TRASH) || orderOf(a) - orderOf(b));

  if (bosses.length === 0) {
    return <section className="panel"><p className="muted">{emptyText ?? 'Nothing here yet.'}</p></section>;
  }

  return bosses.map((boss) => (
    <section className="panel" key={boss}>
      <h2>{boss}</h2>
      <div className="table-wrap">
        <table className="loot-table boss-loot">
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
                            <Link href={`/characters/${w.characters?.id}`} style={{ color: classColor(w.characters?.class) }}>{w.characters?.name}</Link>
                            <span className={`prio prio-${w.priority}`}>{PRIORITY[w.priority]}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="actions-cell">
                    {wantAs && <WantControl itemId={item.id} wanters={wanters} charId={wantAs} onChanged={onChanged} onError={onError} />}
                    {wanters.length > 0 && <RecordLoot itemId={item.id} roster={roster} suggestedIds={wanters.map((w) => w.character_id)} onDone={onChanged} onError={onError} />}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  ));
}
