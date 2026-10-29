'use client';

import Link from 'next/link';
import useProgressData from '@/lib/useProgressData';
import RaidProgress from '@/components/RaidProgress';
import { timeAgo } from '@/components/ActivityFeed';
import { buildRuns, weeklyRaidProgress, lastReset, nextReset, runsPerPlayer } from '@/lib/progress';
import { classColor } from '@/lib/wow';

function untilText(date) {
  const ms = date - Date.now();
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

export default function ProgressPage() {
  const { dungeons, kills, lockouts, characters, bossesByDungeon, error, loaded } = useProgressData();

  const dungeonById = Object.fromEntries(dungeons.map((d) => [d.id, d]));
  const charById = Object.fromEntries(characters.map((c) => [c.id, c]));
  const runs = buildRuns(kills, bossesByDungeon);
  const weekStart = lastReset();
  const isRaid = (r) => dungeonById[r.dungeonId]?.kind === 'raid';
  const weekRuns = runs.filter((r) => r.end >= weekStart.getTime());
  const raids = weeklyRaidProgress({ dungeons, kills, lockouts, bossesByDungeon });
  const started = raids.filter((r) => r.killed > 0);
  const notStarted = raids.filter((r) => r.killed === 0);

  const perPlayer = runsPerPlayer(runs, characters);
  const players = Object.fromEntries(characters.map((c) => [c.owner, c.profiles?.display_name ?? '?']));
  const leaderboard = Object.entries(perPlayer).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const perDungeon = {};
  for (const r of runs) if (r.dungeonId) perDungeon[r.dungeonId] = (perDungeon[r.dungeonId] ?? 0) + 1;
  const topDungeons = Object.entries(perDungeon).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const lastUpload = kills[0]?.killed_at;

  return (
    <>
      <div className="row spread">
        <h1>Progress</h1>
        <span className="muted small">Weekly reset in {untilText(nextReset())}</span>
      </div>
      {error && <p className="error">{error}</p>}

      {/* ---------- Numbers ---------- */}
      <div className="stat-tiles">
        <div className="stat-tile"><span className="stat-num">{started.reduce((s, r) => s + r.killed, 0)}</span><span className="stat-label">raid bosses this week</span></div>
        <div className="stat-tile"><span className="stat-num">{weekRuns.filter((r) => !isRaid(r)).length}</span><span className="stat-label">dungeon runs this week</span></div>
        <div className="stat-tile"><span className="stat-num">{runs.filter((r) => !isRaid(r)).length}</span><span className="stat-label">dungeon runs in total</span></div>
        <div className="stat-tile"><span className="stat-num">{runs.filter(isRaid).length}</span><span className="stat-label">raid nights in total</span></div>
      </div>

      {/* ---------- This week's raids ---------- */}
      <section className="panel">
        <h2>This week&apos;s raids</h2>
        {started.length === 0 ? (
          <p className="muted">No raid bosses down yet this week.</p>
        ) : (
          <div className="raid-grid">{started.map((r) => <RaidProgress key={r.dungeon.id} raid={r} />)}</div>
        )}
        {notStarted.length > 0 && (
          <p className="muted small" style={{ marginTop: '0.9rem' }}>Not started: {notStarted.map((r) => r.dungeon.name).join(', ')}</p>
        )}
      </section>

      <div className="grid-2">
        {/* ---------- Recent runs ---------- */}
        <section className="panel">
          <h2>Recent runs</h2>
          {loaded && runs.length === 0 && (
            <p className="muted">
              Nothing tracked yet. Runs appear here automatically once someone in the group has the Solitude addon and companion
              (<Link href="/companion">set it up</Link>), or when bosses are ticked off on an event page.
            </p>
          )}
          <div className="run-list">
            {runs.slice(0, 15).map((r) => {
              const d = dungeonById[r.dungeonId];
              const members = [...r.characterIds].map((id) => charById[id]).filter(Boolean);
              return (
                <div key={`${r.key}-${r.start}`} className="run">
                  <div className="row spread">
                    <div>
                      {d ? <Link href={`/dungeons/${d.id}`}><strong>{d.name}</strong></Link> : <strong>{r.instance ?? 'Unknown'}</strong>}
                      {d?.kind === 'raid' && <span className="badge" style={{ marginLeft: 6 }}>Raid</span>}
                    </div>
                    <span className="muted small">{new Date(r.end).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                  </div>
                  <div className="muted small">
                    {r.fullClear ? <span className="raid-count done">✓ Full clear</span> : `${r.bosses.length}${r.total ? `/${r.total}` : ''} boss${r.bosses.length === 1 ? '' : 'es'}`}
                    {' · '}{r.bosses.slice(-3).join(', ')}{r.bosses.length > 3 ? '…' : ''}
                  </div>
                  {members.length > 0 && (
                    <div className="run-members">
                      {members.slice(0, 10).map((c) => (
                        <Link key={c.id} href={`/characters/${c.id}`} style={{ color: classColor(c.class) }}>{c.name}</Link>
                      ))}
                      {members.length > 10 && <span className="muted small">+{members.length - 10}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <div className="stack-panels">
          {/* ---------- Leaderboard ---------- */}
          <section className="panel">
            <h2>Most active</h2>
            {leaderboard.length === 0 ? <p className="muted">No runs yet.</p> : (
              <div className="stack">
                {leaderboard.map(([owner, n], i) => (
                  <div key={owner} className="row spread">
                    <span><span className="muted" style={{ display: 'inline-block', width: '1.5rem' }}>{i + 1}.</span>{players[owner] ?? '?'}</span>
                    <span className="badge">{n} run{n === 1 ? '' : 's'}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ---------- Per dungeon ---------- */}
          <section className="panel">
            <h2>Most run</h2>
            {topDungeons.length === 0 ? <p className="muted">No runs yet.</p> : (
              <div className="stack">
                {topDungeons.map(([id, n]) => (
                  <div key={id} className="row spread">
                    <Link href={`/dungeons/${id}`}>{dungeonById[id]?.name ?? '?'}</Link>
                    <span className="badge">{n}×</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <h2>How tracking works</h2>
            <p className="muted small" style={{ margin: 0 }}>
              The Solitude addon records boss kills while you play; the companion app uploads them when you log out.
              Only one person in each group needs it. {lastUpload && <>Last kill recorded {timeAgo(lastUpload)}.</>}{' '}
              <Link href="/companion">Set it up →</Link>
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
