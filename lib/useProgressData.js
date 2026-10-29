'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { cached } from './cache';
import { loadDungeons } from './suggest';

// Loads everything the Progress page and dashboard card need.
export default function useProgressData({ days = 120 } = {}) {
  const [data, setData] = useState({ dungeons: [], kills: [], lockouts: [], bosses: [], characters: [] });
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const [d, k, l, b, c] = await Promise.all([
      loadDungeons().then((data) => ({ data }), (error) => ({ error })),
      supabase.from('boss_kills').select('*').gte('killed_at', since).order('killed_at', { ascending: false }).limit(1000),
      supabase.from('raid_lockouts').select('*').gt('resets_at', new Date().toISOString()),
      // Boss list comes from the loot table and barely changes: share it for 10 minutes
      cached('dungeon_bosses', async () => { const r = await supabase.from('dungeon_bosses').select('*'); if (r.error) throw r.error; return r; }, 600_000).catch((error) => ({ error })),
      supabase.from('characters').select('id, name, class, owner, profiles(display_name)'),
    ]);
    const err = d.error || k.error || l.error || b.error || c.error;
    if (err) setError(err.message.includes('boss_kills') || err.message.includes('dungeon_bosses') || err.code === '42P01'
      ? 'Progress tracking needs the latest database update: run supabase/schema-6-progress.sql in Supabase.'
      : err.message);
    setData({ dungeons: d.data ?? [], kills: k.data ?? [], lockouts: l.data ?? [], bosses: b.data ?? [], characters: c.data ?? [] });
    setLoaded(true);
  }, [days]);

  useEffect(() => { load(); }, [load]);

  // { dungeonId: [boss names in rough order] } from the view
  const bossesByDungeon = {};
  for (const row of [...data.bosses].sort((a, b) => (a.avg_ilvl ?? 0) - (b.avg_ilvl ?? 0))) {
    (bossesByDungeon[row.dungeon_id] ??= []).push(row.boss);
  }

  return { ...data, bossesByDungeon, error, loaded, reload: load };
}
