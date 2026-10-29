'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

// One-click "Load starter guides": fills in the beginner guide for every Classic
// dungeon and raid from /public/data/classic-guides.json.
// Only fills gaps: never overwrites tactics your group has written.
export default function ImportGuides({ onDone, compact = false }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function run() {
    setBusy(true);
    setError('');
    try {
      setMessage('Downloading guides…');
      const res = await fetch('/data/classic-guides.json');
      if (!res.ok) throw new Error('Could not download the guides');
      const guides = await res.json();

      // Dungeons: make sure each exists, then fill in its overview if it has none
      setMessage('Adding dungeon overviews…');
      const { data: dungeons, error: dErr } = await supabase.from('dungeons').select('id, name, guide_overview');
      if (dErr) throw dErr;
      const byName = Object.fromEntries(dungeons.map((d) => [d.name, d]));
      for (const g of guides) {
        let d = byName[g.name];
        if (!d) {
          const { data, error } = await supabase.from('dungeons').insert({ name: g.name, kind: g.kind }).select('id, name, guide_overview').single();
          if (error) throw error;
          d = byName[g.name] = data;
        }
        if (!d.guide_overview) {
          const { error } = await supabase.from('dungeons').update({
            guide_where: g.where, guide_overview: g.overview, guide_before: g.before, guide_route: g.route, guide_tips: g.tips,
          }).eq('id', d.id);
          if (error) throw error;
        }
      }

      // Boss tactics: only for bosses nobody has written about yet
      setMessage('Adding boss tactics…');
      const { data: existing, error: nErr } = await supabase.from('boss_notes').select('dungeon_id, boss');
      if (nErr) throw nErr;
      const have = new Set(existing.map((n) => `${n.dungeon_id}|${n.boss.toLowerCase()}`));
      const rows = [];
      for (const g of guides) {
        const id = byName[g.name].id;
        g.bosses.forEach((b, i) => {
          if (have.has(`${id}|${b.boss.toLowerCase()}`)) return;
          rows.push({ dungeon_id: id, boss: b.boss, position: i + 1, summary: b.summary, tank: b.tank, healer: b.healer, dps: b.dps, source: 'guide', updated_by: null });
        });
      }
      for (let i = 0; i < rows.length; i += 100) {
        const { error } = await supabase.from('boss_notes').insert(rows.slice(i, i + 100));
        if (error) throw error;
      }

      setMessage(`Done! Added guides for ${guides.length} dungeons and ${rows.length} bosses.`);
      onDone?.();
    } catch (e) {
      const msg = e.message ?? String(e);
      setError(msg.includes('guide_') || msg.includes('source')
        ? 'The database needs updating first: run supabase/schema-9-starter-guides.sql in Supabase.'
        : msg);
      setMessage('');
    }
    setBusy(false);
  }

  if (compact) {
    return (
      <span className="small">
        <button className="btn small" onClick={run} disabled={busy}>{busy ? 'Loading…' : '📖 Load starter guides'}</button>
        {message && <span className="muted"> {message}</span>}
        {error && <span className="error"> {error}</span>}
      </span>
    );
  }

  return (
    <section className="panel import-panel">
      <h2>Load the starter guides</h2>
      <p className="muted">
        One click adds a beginner guide to every Classic dungeon and raid: where it is, what to bring, the route,
        and every boss explained with tips for tanks, healers and DPS. It never overwrites tactics your group has written.
      </p>
      <button className="btn" onClick={run} disabled={busy}>{busy ? 'Loading…' : '📖 Load starter guides'}</button>
      {message && <p className="muted small">{message}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
