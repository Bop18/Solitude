import Link from 'next/link';

// One raid's progress this week: bar + boss chips.
export default function RaidProgress({ raid, compact = false }) {
  const { dungeon, bosses, killed, total } = raid;
  const pct = total ? Math.round((killed / total) * 100) : 0;
  const next = bosses.find((b) => !b.killed);
  return (
    <div className={`raid-progress ${compact ? 'compact' : ''}`}>
      <div className="row spread">
        <Link href={`/dungeons/${dungeon.id}`} className="raid-name">{dungeon.name}</Link>
        <span className={`raid-count ${killed === total && total ? 'done' : ''}`}>
          {killed}/{total}{killed === total && total ? ' ✓ Cleared' : ''}
        </span>
      </div>
      <div className="level-bar raid-bar">
        <div className="level-fill" style={{ width: `${pct}%`, background: killed === total ? 'var(--ok)' : 'var(--accent)', color: killed === total ? 'var(--ok)' : 'var(--accent)' }} />
      </div>
      {!compact && (
        <div className="boss-chips">
          {bosses.map((b) => (
            <span key={b.name} className={`boss-chip ${b.killed ? 'killed' : ''}`} title={b.killedAt ? `Killed ${b.killedAt.toLocaleString()}` : b.killed ? 'Killed this week' : 'Still alive'}>
              {b.killed ? '✓ ' : ''}{b.name}
            </span>
          ))}
        </div>
      )}
      {compact && next && killed > 0 && <div className="muted small">Next: {next.name}</div>}
    </div>
  );
}
