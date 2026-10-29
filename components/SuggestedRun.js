'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { DAYS, classColor } from '@/lib/wow';
import { bestBlocks, hourLabel, nextDate, toLocalInput } from '@/lib/availability';
import { fetchAll, itemsForLevels, loadCharactersWithGear, loadDungeons, mainsByOwner, rankDungeons } from '@/lib/suggest';

// Dashboard: "Suggested next run": the best time from Availability, and the dungeon
// with the most upgrades for the people free then.
export default function SuggestedRun() {
  const [s, setS] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | empty | error

  useEffect(() => {
    (async () => {
      try {
        const [hours, profiles, characters, dungeons] = await Promise.all([
          fetchAll(() => supabase.from('availability_hours').select('*')).catch(() => []),
          supabase.from('profiles').select('id, display_name').then((r) => r.data ?? []),
          loadCharactersWithGear(),
          loadDungeons(),
        ]);
        const mains = mainsByOwner(characters);
        const names = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]));

        // Best block of time (if people have filled in availability)
        const free = {};
        for (const h of hours) {
          const main = mains[h.user_id];
          (free[`${h.day}-${h.hour}`] ??= []).push({ id: h.user_id, name: names[h.user_id] ?? '?', role: main?.role ?? null });
        }
        const blocks = bestBlocks(free, { minPlayers: Math.min(3, Object.keys(mains).length || 1), limit: 6 });
        const block = blocks.find((b) => b.ready) ?? blocks[0] ?? null;

        // Whose characters to plan for: the people free in that block, or everyone
        const ownerIds = block
          ? Object.entries(names).filter(([, n]) => block.names.includes(n)).map(([id]) => id)
          : Object.keys(mains);
        const group = ownerIds.map((id) => mains[id]).filter(Boolean);
        if (!group.length) return setState('empty');

        const levels = group.map((c) => c.level);
        const items = await itemsForLevels(Math.min(...levels), Math.max(...levels));
        const ranked = rankDungeons({ characters: group, items, dungeons, includeRaids: group.length >= 10 });
        if (!ranked.length) return setState('empty');
        setS({ block, top: ranked[0], others: ranked.slice(1, 3), groupSize: group.length });
        setState('ready');
      } catch {
        setState('error');
      }
    })();
  }, []);

  if (state === 'loading') return <section className="panel"><h2>Suggested next run</h2><p className="muted">Working it out…</p></section>;
  if (state === 'error') return null;
  if (state === 'empty') {
    return (
      <section className="panel">
        <h2>Suggested next run</h2>
        <p className="muted">
          Once people add characters, gear and <Link href="/availability">availability</Link>, the site suggests the best time and dungeon here.
        </p>
      </section>
    );
  }

  const { block, top, others, groupSize } = s;
  const when = block ? nextDate(block.day, block.from) : null;
  const planHref = `/events?dungeon=${top.dungeon.id}${when ? `&when=${encodeURIComponent(toLocalInput(when))}` : ''}`;

  return (
    <section className="panel suggest">
      <div className="row spread">
        <h2>Suggested next run</h2>
        {block && (block.ready ? <span className="badge ok-badge">✓ Group ready</span> : <span className="badge">Needs {block.missing.join(' + ')}</span>)}
      </div>
      <div className="suggest-main">
        <div className="suggest-dungeon">{top.dungeon.name}</div>
        <div className="muted">
          {block
            ? <>{DAYS[block.day]} {hourLabel(block.from)}–{hourLabel(block.to)} · {when.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</>
            : <>Best for your group right now</>}
        </div>
      </div>
      <p style={{ margin: '0.6rem 0' }}>
        <strong>{top.total} upgrade{top.total === 1 ? '' : 's'}</strong> for {top.perChar.length} of {groupSize} people:
      </p>
      <div className="suggest-chars">
        {top.perChar.slice(0, 6).map((p) => (
          <span key={p.char.id} className="suggest-char">
            <Link href={`/characters/${p.char.id}`} style={{ color: classColor(p.char.class) }}>{p.char.name}</Link>
            <span className="gain">{p.count}</span>
          </span>
        ))}
      </div>
      <div className="row" style={{ marginTop: '0.9rem' }}>
        <Link className="btn small" href={planHref}>Plan it</Link>
        <Link className="btn ghost small" href={`/dungeons/${top.dungeon.id}`}>See the loot</Link>
      </div>
      {others.length > 0 && (
        <p className="muted small" style={{ margin: '0.8rem 0 0' }}>
          Also good: {others.map((o, i) => (
            <span key={o.dungeon.id}>{i > 0 && ', '}<Link href={`/dungeons/${o.dungeon.id}`}>{o.dungeon.name}</Link> ({o.total})</span>
          ))}
        </p>
      )}
    </section>
  );
}
