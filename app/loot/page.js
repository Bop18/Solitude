'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import ItemName from '@/components/ItemName';
import WantControl from '@/components/WantControl';
import { PRIORITY, classColor } from '@/lib/wow';

// "Who needs what": every open wishlist item, grouped by dungeon.
// You can add yourself to anything here with "Want too".
export default function LootPage() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [wishes, setWishes] = useState([]);
  const [myChars, setMyChars] = useState([]);
  const [wantAs, setWantAs] = useState('');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [w, ch] = await Promise.all([
      supabase
        .from('wishlist')
        .select('*, items(*, dungeons(id, name, min_level)), characters(id, name, class, level, profiles(display_name))')
        .eq('obtained', false)
        .order('priority'),
      supabase.from('characters').select('id, name, is_main').eq('owner', userId).order('is_main', { ascending: false }),
    ]);
    const err = w.error || ch.error;
    if (err) setError(err.message);
    setWishes(w.data ?? []);
    setMyChars(ch.data ?? []);
    setWantAs((cur) => cur || String(ch.data?.[0]?.id ?? ''));
    setLoaded(true);
  }, [userId]);

  useEffect(() => { if (userId) load(); }, [load, userId]);

  // dungeon -> item -> list of wishes for it
  const dungeons = {};
  for (const w of wishes) {
    const d = w.items.dungeons ?? { id: 0, name: 'Other', min_level: 999 };
    const entry = (dungeons[d.id] ??= { dungeon: d, items: {} });
    (entry.items[w.item_id] ??= { item: w.items, wanters: [] }).wanters.push(w);
  }
  const sorted = Object.values(dungeons).sort((a, b) => (a.dungeon.min_level ?? 999) - (b.dungeon.min_level ?? 999));

  return (
    <>
      <div className="row spread">
        <h1>Loot needs</h1>
        {myChars.length > 1 && (
          <div className="row">
            <label htmlFor="wa" style={{ margin: 0 }}>Wishlist for</label>
            <select id="wa" value={wantAs} onChange={(e) => setWantAs(e.target.value)} style={{ width: 'auto' }}>
              {myChars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
      </div>
      <p className="muted">Everything people still want, grouped by where it drops. Want something here too? Hit <strong>Want too</strong> and pick how much you need it.</p>
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
              <thead><tr><th>Item</th><th>Boss</th><th>Wanted by</th><th></th></tr></thead>
              <tbody>
                {Object.values(items).map(({ item, wanters }) => (
                  <tr key={item.id}>
                    <td>
                      <ItemName item={item} />
                      {wanters.length > 1 && <div><span className="badge gold">{wanters.length} want this</span></div>}
                    </td>
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
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <WantControl itemId={item.id} wanters={wanters} charId={wantAs} onChanged={load} onError={setError} />
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
