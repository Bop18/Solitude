'use client';

import { totalStats, statRows } from '@/lib/itemScore';
import { classColor } from '@/lib/wow';

const ORDER = ['Attributes', 'Defence', 'Melee & ranged', 'Spells', 'Bonuses', 'Resistances'];

// Character sheet: everything the gear adds up to, in one place
export default function GearStats({ character, gear }) {
  const rows = Object.values(gear);
  const known = rows.map((r) => r.items).filter(Boolean);
  const unknown = rows.filter((r) => !r.items || !r.items.stats || !Object.keys(r.items.stats).length).length;
  const lines = statRows(totalStats(known), { weapon: (gear['Main Hand'] ?? gear['Two-Hand'])?.items });
  const groups = ORDER.map((g) => ({ g, list: lines.filter((l) => l.group === g) })).filter((x) => x.list.length);

  return (
    <section className="panel">
      <h2>Stats from gear</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        Everything <span style={{ color: classColor(character.class) }}>{character.name}</span>&apos;s gear adds, totalled up.
        Talents, buffs and base stats aren&apos;t included.
      </p>
      {groups.length === 0 ? (
        <p className="muted">No stats yet. Add gear (or sync it) and the totals show here.</p>
      ) : (
        <div className="stat-sheet">
          {groups.map(({ g, list }) => (
            <div key={g} className="stat-group">
              <h3>{g}</h3>
              {list.map((l) => (
                <div key={l.label} className="sheet-line"><span>{l.label}</span><strong>{l.value}</strong></div>
              ))}
            </div>
          ))}
        </div>
      )}
      {unknown > 0 && groups.length > 0 && (
        <p className="muted small">{unknown} item{unknown === 1 ? ' has' : 's have'} no stats on the site yet, so {unknown === 1 ? 'it isn’t' : 'they aren’t'} counted.</p>
      )}
    </section>
  );
}
