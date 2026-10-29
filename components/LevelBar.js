import { MAX_LEVEL, classColor } from '@/lib/wow';

export default function LevelBar({ level, className }) {
  const pct = Math.min(100, Math.round((level / MAX_LEVEL) * 100));
  return (
    <div className="level" title={`Level ${level} / ${MAX_LEVEL}`}>
      <strong style={{ minWidth: '1.6rem' }}>{level}</strong>
      <div className="level-bar">
        <div className="level-fill" style={{ width: `${pct}%`, background: classColor(className) }} />
      </div>
    </div>
  );
}
