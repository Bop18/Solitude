'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

const DUNGEON_DEFAULTS = {
  'Lower Blackrock Spire': { kind: 'dungeon', min_level: 55, max_level: 60, size: 5 },
  'Upper Blackrock Spire': { kind: 'raid', min_level: 58, max_level: 60, size: 10 },
};

// One-time button that loads every Classic item (8,700 of them, with stats and
// which boss drops what) from /public/data/classic-items.json into the database.
// Safe to run again: it updates items instead of duplicating them.
export default function ImportItems({ onDone, compact = false }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function run() {
    setBusy(true);
    setError('');
    setMessage('Downloading item data…');
    setProgress(0);
    try {
      const res = await fetch('/data/classic-items.json');
      if (!res.ok) throw new Error('Could not download item data');
      const raw = await res.json();

      // Make sure every dungeon in the data exists, and find their ids
      const { data: existing, error: dErr } = await supabase.from('dungeons').select('id, name');
      if (dErr) throw dErr;
      const ids = Object.fromEntries(existing.map((d) => [d.name, d.id]));
      const missing = [...new Set(raw.map((r) => r.d).filter((d) => d && !ids[d]))];
      for (const name of missing) {
        const { data, error } = await supabase
          .from('dungeons')
          .insert({ name, ...(DUNGEON_DEFAULTS[name] ?? {}) })
          .select('id')
          .single();
        if (error) throw error;
        ids[name] = data.id;
      }

      const rows = raw.map((r) => ({
        game_id: r.id,
        name: r.n,
        quality: r.q,
        ilvl: r.il,
        req_level: r.rl,
        slot: r.sl,
        kind: r.ty,
        item_type: r.st ?? null,
        stats: r.s ?? {},
        dps: r.dps ?? null,
        speed: r.spd ?? null,
        class_restrict: r.cr ?? [],
        dungeon_id: r.d ? ids[r.d] : null,
        boss: r.b ?? null,
        drop_chance: r.dc ?? null,
        notes: r.nt ?? null,
        icon: r.ic ?? null,
        link: `https://www.wowhead.com/classic/item=${r.id}`,
      }));

      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        setMessage(`Saving items ${i + 1}–${Math.min(i + CHUNK, rows.length)} of ${rows.length}…`);
        const { error } = await supabase.from('items').upsert(rows.slice(i, i + CHUNK), { onConflict: 'game_id' });
        if (error) throw error;
        setProgress(Math.round(((i + CHUNK) / rows.length) * 100));
      }

      setMessage('Tidying up items you typed in by hand…');
      const { data: merged, error: mErr } = await supabase.rpc('merge_duplicate_items');
      if (mErr) throw mErr;

      setProgress(100);
      setMessage(`Done! Loaded ${rows.length.toLocaleString()} items${merged ? `, merged ${merged} hand-typed item${merged === 1 ? '' : 's'}` : ''}.`);
      onDone?.();
    } catch (e) {
      setError(e.message ?? String(e));
    }
    setBusy(false);
  }

  if (compact) {
    return (
      <span className="small">
        <button className="btn ghost small" onClick={run} disabled={busy}>{busy ? `Updating… ${progress}%` : 'Reload game item data'}</button>
        {error && <span className="error"> {error}</span>}
      </span>
    );
  }

  return (
    <section className="panel import-panel">
      <h2>Load the Classic loot list</h2>
      <p className="muted">
        One click loads every Classic dungeon and raid drop: about 8,700 items with their stats, bosses and drop chances.
        The site then works out which classes each item is for and who in your group it&apos;s an upgrade for.
        It takes about 30 seconds and only needs doing once, by anyone.
      </p>
      {busy || progress ? (
        <div className="stack">
          <div className="level-bar" style={{ height: 10 }}><div className="level-fill" style={{ width: `${progress}%`, background: 'var(--accent)', color: 'var(--accent)' }} /></div>
          <p className="muted small">{message}</p>
        </div>
      ) : (
        <button className="btn" onClick={run}>Load Classic loot</button>
      )}
      {error && <p className="error">Something went wrong: {error}. Check you ran <code>schema-3-auto-loot.sql</code> in Supabase, then try again.</p>}
    </section>
  );
}
