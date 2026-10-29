'use client';

import Link from 'next/link';
import useProgressData from '@/lib/useProgressData';
import RaidProgress from './RaidProgress';
import { buildRuns, weeklyRaidProgress, lastReset } from '@/lib/progress';

// Dashboard card: this week's raid progress + dungeon runs.
export default function WeeklyCard() {
  const { dungeons, kills, lockouts, bossesByDungeon, error, loaded } = useProgressData({ days: 8 });
  if (error) return null; // database not updated yet; the Progress page explains
  const raids = weeklyRaidProgress({ dungeons, kills, lockouts, bossesByDungeon }).filter((r) => r.killed > 0);
  const kinds = Object.fromEntries(dungeons.map((d) => [d.id, d.kind]));
  const weekRuns = buildRuns(kills, bossesByDungeon).filter((r) => r.end >= lastReset().getTime() && kinds[r.dungeonId] !== 'raid');

  return (
    <section className="panel">
      <div className="row spread">
        <h2>This week</h2>
        <Link href="/progress" className="small">Progress →</Link>
      </div>
      {loaded && raids.length === 0 && weekRuns.length === 0 ? (
        <p className="muted">Nothing tracked yet this week.</p>
      ) : (
        <div className="stack">
          {raids.slice(0, 3).map((r) => <RaidProgress key={r.dungeon.id} raid={r} compact />)}
          <p className="muted small" style={{ margin: 0 }}>{weekRuns.length} dungeon run{weekRuns.length === 1 ? '' : 's'} since the reset</p>
        </div>
      )}
    </section>
  );
}
