'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import ItemName from './ItemName';
import { classColor } from '@/lib/wow';

export function timeAgo(iso) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

const ICONS = { level: '⬆️', loot: '🎁', event: '📅', character: '✨', kill: '⚔️' };

export default function ActivityFeed({ limit = 15 }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const base = '*, characters(id, name, class), items(*), events(id, title, starts_at), profiles(display_name)';
      let { data, error } = await supabase
        .from('activity')
        .select(`${base}, dungeons(id, name)`)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) {
        // Older database (before the progress update): load without dungeon names
        ({ data, error } = await supabase.from('activity').select(base).order('created_at', { ascending: false }).limit(limit));
      }
      if (error) setError(error.message);
      setRows(data ?? []);
      setLoaded(true);
    })();
  }, [limit]);

  const Char = ({ c }) =>
    c ? <Link href={`/characters/${c.id}`} style={{ color: classColor(c.class), fontWeight: 600 }}>{c.name}</Link> : <strong>Someone</strong>;

  function text(a) {
    switch (a.kind) {
      case 'level':
        return <><Char c={a.characters} /> hit level {a.level}!{a.level >= 60 ? ' 👑' : ''}</>;
      case 'loot':
        return <><Char c={a.characters} /> got {a.items ? <ItemName item={a.items} /> : 'an item'}</>;
      case 'event':
        return a.events
          ? <><strong>{a.profiles?.display_name ?? 'Someone'}</strong> planned <Link href={`/events/${a.events.id}`}>{a.events.title}</Link></>
          : <><strong>{a.profiles?.display_name ?? 'Someone'}</strong> planned a run</>;
      case 'kill':
        return (
          <>
            First kill: <strong>{a.detail}</strong>
            {a.dungeons && <> in <Link href={`/dungeons/${a.dungeons.id}`}>{a.dungeons.name}</Link></>}!
          </>
        );
      case 'character':
        return <><strong>{a.profiles?.display_name ?? 'Someone'}</strong> added <Char c={a.characters} />{a.level ? `, level ${a.level}` : ''}</>;
      default:
        return null;
    }
  }

  if (error) {
    return <p className="muted small">The activity feed needs the latest database update (<code>schema-3-auto-loot.sql</code>).</p>;
  }
  if (loaded && rows.length === 0) return <p className="muted">Nothing yet. Level-ups, loot and new runs will show up here.</p>;

  return (
    <div className="feed">
      {rows.map((a) => (
        <div key={a.id} className="feed-item">
          <span className="feed-icon" aria-hidden>{ICONS[a.kind]}</span>
          <div className="feed-text">{text(a)}</div>
          <span className="feed-time">{timeAgo(a.created_at)}</span>
        </div>
      ))}
    </div>
  );
}
