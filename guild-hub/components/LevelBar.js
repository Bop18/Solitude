import { MAX_LEVEL, classColor } from '@/lib/wow';

export default function LevelBar({ level, className, max = MAX_LEVEL }) {
  const pct = Math.min(100, Math.round((level / max) * 100));
  return (
    <div className="level" title={`Level ${level} / ${max}`}>
      <strong style={{ minWidth: '1.6rem' }}>{level}</strong>
      <div className="level-bar">
        <div className="level-fill" style={{ width: `${pct}%`, background: classColor(className), color: classColor(className) }} />
      </div>
    </div>
  );
}
