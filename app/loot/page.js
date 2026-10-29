'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import ItemName from '@/components/ItemName';
import { PRIORITY, classColor } from '@/lib/wow';

// "Who needs what": every open wishlist item, grouped by dungeon.
export default function LootPage() {
  const [wishes, setWishes] = useState([]);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('wishlist')
        .select('*, items(*, dungeons(id, name, min_level)), characters(id, name, class, level, profiles(display_name))')
        .eq('obtained', false)
        .order('priority');
      if (error) setError(error.message);
      setWishes(data ?? []);
      setLoaded(true);
    })();
  }, []);

  // dungeon -> item -> list of characters wanting it
  const dungeons = {};
  for (const w of wishes) {
    const d = w.items.dungeons ?? { id: 0, name: 'Other', min_level: 999 };
    const entry = (dungeons[d.id] ??= { dungeon: d, items: {} });
    (entry.items[w.item_id] ??= { item: w.items, wanters: [] }).wanters.push(w);
  }
  const sorted = Object.values(dungeons).sort((a, b) => (a.dungeon.min_level ?? 999) - (b.dungeon.min_level ?? 999));

  return (
    <>
      <h1>Loot needs</h1>
      <p className="muted">Everything people still want, grouped by where it drops. Check here before a run, or open an event linked to a dungeon.</p>
      {error && <p className="error">{error}</p>}
      {loaded && sorted.length === 0 && (
        <section className="panel"><p className="muted">No wishlists yet. Open a <Link href="/dungeons">dungeon</Link> and hit <strong>Want</strong> on items.</p></section>
      )}

      {sorted.map(({ dungeon, items }) => (
        <section className="panel" key={dungeon.id}>
          <div className="row spread">
            <h2>{dungeon.id ? <Link href={`/dungeons/${dungeon.id}`}>{dungeon.name}</Link> : dungeon.name}</h2>
            <span className="muted small">{Object.keys(items).length} item{Object.keys(items).length === 1 ? '' : 's'} wanted</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Item</th><th>Boss</th><th>Wanted by</th></tr></thead>
              <tbody>
                {Object.values(items).map(({ item, wanters }) => (
                  <tr key={item.id}>
                    <td><ItemName item={item} />{wanters.length > 1 && <span className="badge gold" style={{ marginLeft: 6 }}>{wanters.length} want this</span>}</td>
                    <td className="muted">{item.boss ?? '—'}</td>
                    <td>
                      <div className="wanters">
                        {[...wanters].sort((a, b) => a.priority - b.priority).map((w) => (
                          <span key={w.id} className="wanter">
                            <Link href={`/characters/${w.characters.id}`} style={{ color: classColor(w.characters.class) }}>{w.characters.name}</Link>
                            <span className="muted small">{w.characters.profiles?.display_name}</span>
                            <span className={`prio prio-${w.priority}`}>{PRIORITY[w.priority]}</span>
                          </span>
                        ))}
                      </div>
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
