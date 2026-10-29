'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import ItemName from '@/components/ItemName';
import WantControl from '@/components/WantControl';
import RecordLoot from '@/components/RecordLoot';
import LootTabs from '@/components/LootTabs';
import { PRIORITY, classColor } from '@/lib/wow';

// "Who needs what": every open Need, grouped by dungeon.
export default function LootPage() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [wishes, setWishes] = useState([]);
  const [roster, setRoster] = useState([]);
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
      supabase.from('characters').select('id, name, class, owner, is_main').order('name'),
    ]);
    const err = w.error || ch.error;
    if (err) setError(err.message);
    setWishes(w.data ?? []);
    setRoster(ch.data ?? []);
    const mine = (ch.data ?? []).filter((c) => c.owner === userId).sort((a, b) => b.is_main - a.is_main);
    setWantAs((cur) => cur || String(mine[0]?.id ?? ''));
    setLoaded(true);
  }, [userId]);

  useEffect(() => { if (userId) load(); }, [load, userId]);

  const myChars = roster.filter((c) => c.owner === userId);

  // dungeon -> item -> list of needs
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
        <h1>Loot</h1>
        {myChars.length > 1 && (
          <div className="row">
            <label htmlFor="wa" style={{ margin: 0 }}>Needing as</label>
            <select id="wa" value={wantAs} onChange={(e) => setWantAs(e.target.value)} style={{ width: 'auto' }}>
              {myChars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
      </div>
      <LootTabs />
      <p className="muted">Everything people still need, grouped by where it drops. Need it too? Hit <strong>Need too</strong>. When it drops, hit <strong>Looted</strong> to record who got it.</p>
      {error && <p className="error">{error}</p>}
      {loaded && sorted.length === 0 && (
        <section className="panel"><p className="muted">Nobody needs anything yet. Open a <Link href="/dungeons">dungeon</Link> to see what&apos;s an upgrade for you.</p></section>
      )}

      {sorted.map(({ dungeon, items }) => (
        <section className="panel" key={dungeon.id}>
          <div className="row spread">
            <h2>{dungeon.id ? <Link href={`/dungeons/${dungeon.id}`}>{dungeon.name}</Link> : dungeon.name}</h2>
            <span className="muted small">{Object.keys(items).length} item{Object.keys(items).length === 1 ? '' : 's'} needed</span>
          </div>
          <div className="table-wrap">
            <table className="loot-table">
              <thead><tr><th>Item</th><th>Boss</th><th>Needed by</th><th></th></tr></thead>
              <tbody>
                {Object.values(items).map(({ item, wanters }) => (
                  <tr key={item.id}>
                    <td>
                      <ItemName item={item} />
                      {wanters.length > 1 && <div><span className="badge gold">{wanters.length} need this</span></div>}
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
                    <td className="actions-cell">
                      <WantControl itemId={item.id} wanters={wanters} charId={wantAs} onChanged={load} onError={setError} />
                      <RecordLoot itemId={item.id} roster={roster} suggestedIds={wanters.map((w) => w.character_id)} onDone={load} onError={setError} />
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
