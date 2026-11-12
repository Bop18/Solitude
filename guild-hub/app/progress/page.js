'use client';

import { useEffect, useState } from 'react';
import RetailProgress from '@/components/RetailProgress';
import ClassicCharacters from '@/components/ClassicCharacters';
import Link from 'next/link';
import useProgressData from '@/lib/useProgressData';
import RaidProgress from '@/components/RaidProgress';
import { timeAgo } from '@/components/ActivityFeed';
import { buildRuns, weeklyRaidProgress, lastReset, nextReset, playerStats } from '@/lib/progress';
import { classColor } from '@/lib/wow';
import { CURSEFORGE_URL, CURSEFORGE_NAME } from '@/lib/site';

function untilText(date) {
  const ms = date - Date.now();
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

export default function ProgressPage() {
  const [game, setGame] = useState('classic');
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('game') === 'retail') setGame('retail');
  }, []);
  const pick = (g) => (e) => {
    e.preventDefault();
    setGame(g);
    window.history.replaceState(null, '', g === 'retail' ? '?game=retail' : window.location.pathname);
  };
  return (
    <>
      <div className="row spread">
        <h1>Progress</h1>
        {game === 'classic' && <span className="muted small">Weekly reset in {untilText(nextReset())}</span>}
      </div>
      <nav className="tabs game-tabs">
        <a href="#" className={game === 'classic' ? 'active' : ''} onClick={pick('classic')}>Classic</a>
        <a href="#" className={game === 'retail' ? 'active' : ''} onClick={pick('retail')}>Retail</a>
      </nav>
      {game === 'retail' ? <RetailProgress /> : <ClassicProgress />}
    </>
  );
}

function ClassicProgress() {
  const { dungeons, kills, lockouts, characters, bossesByDungeon, error, loaded } = useProgressData();
  const [period, setPeriod] = useState('all'); // 'week' | 'all'

  const dungeonById = Object.fromEntries(dungeons.map((d) => [d.id, d]));
  const charById = Object.fromEntries(characters.map((c) => [c.id, c]));
  const runs = buildRuns(kills, bossesByDungeon);
  const weekStart = lastReset();
  const isRaid = (r) => dungeonById[r.dungeonId]?.kind === 'raid';
  const weekRuns = runs.filter((r) => r.end >= weekStart.getTime());
  const raids = weeklyRaidProgress({ dungeons, kills, lockouts, bossesByDungeon });
  const started = raids.filter((r) => r.killed > 0);
  const notStarted = raids.filter((r) => r.killed === 0);

  const players = Object.fromEntries(characters.map((c) => [c.owner, c.profiles?.display_name ?? '?']));
  const kindOf = (id) => dungeonById[id]?.kind;
  const leaderboard = playerStats(runs, characters, kindOf, { since: period === 'week' ? weekStart : null });
  const best = (key) => Math.max(0, ...leaderboard.map((p) => p[key]));

  const perDungeon = {};
  for (const r of runs) if (r.dungeonId) perDungeon[r.dungeonId] = (perDungeon[r.dungeonId] ?? 0) + 1;
  const topDungeons = Object.entries(perDungeon).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const lastUpload = kills[0]?.killed_at;

  return (
    <>
      {error && <p className="error">{error}</p>}

      {/* ---------- Characters (click one for their week) ---------- */}
      {loaded && <ClassicCharacters dungeons={dungeons} kills={kills} lockouts={lockouts} characters={characters} bossesByDungeon={bossesByDungeon} />}

      <h2 style={{ margin: '1.75rem 0 0.75rem' }}>The whole group</h2>
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

      {/* ---------- Leaderboard ---------- */}
      <section className="panel">
        <div className="row spread">
          <h2>Leaderboard</h2>
          <div className="tabs" style={{ margin: 0 }}>
            <a href="#" className={period === 'week' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setPeriod('week'); }}>This week</a>
            <a href="#" className={period === 'all' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setPeriod('all'); }}>All time</a>
          </div>
        </div>
        {leaderboard.length === 0 ? (
          <p className="muted">{period === 'week' ? 'No runs yet this week.' : 'No runs tracked yet.'}</p>
        ) : (
          <div className="table-wrap">
            <table className="leaderboard">
              <thead>
                <tr><th>#</th><th>Player</th><th>Dungeons</th><th>Raids</th><th>Full clears</th><th>Bosses killed</th></tr>
              </thead>
              <tbody>
                {leaderboard.map((p, i) => (
                  <tr key={p.owner}>
                    <td className="rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</td>
                    <td><strong>{players[p.owner] ?? '?'}</strong></td>
                    <td className={p.dungeons && p.dungeons === best('dungeons') ? 'top' : ''}>{p.dungeons}</td>
                    <td className={p.raids && p.raids === best('raids') ? 'top' : ''}>{p.raids}</td>
                    <td className={p.fullClears && p.fullClears === best('fullClears') ? 'top' : ''}>{p.fullClears}</td>
                    <td className={p.bosses && p.bosses === best('bosses') ? 'top' : ''}>{p.bosses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted small" style={{ margin: '0.6rem 0 0' }}>Counts every run any of your characters was in. Highlighted = most in the group.</p>
      </section>

      <div className="grid-2">
        {/* ---------- Recent runs ---------- */}
        <section className="panel">
          <h2>Recent runs</h2>
          {loaded && runs.length === 0 && (
            <p className="muted">
              Nothing tracked yet. Runs appear here automatically once someone in the group has the {CURSEFORGE_NAME} addon
              from CurseForge plus the companion (<Link href="/companion">setup guide</Link>), or when bosses are ticked off on an event page.
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
            <p className="muted small" style={{ marginTop: 0 }}>
              Install the <strong>{CURSEFORGE_NAME}</strong> addon from CurseForge. It records boss kills while you play,
              and the Solitude companion uploads them when you log out. Only one person in each group needs it.
              {lastUpload && <> Last kill recorded {timeAgo(lastUpload)}.</>}
            </p>
            <div className="row">
              {CURSEFORGE_URL && <a className="btn small" href={CURSEFORGE_URL} target="_blank" rel="noreferrer">Get the addon ↗</a>}
              <Link href="/companion" className="btn ghost small">Setup guide</Link>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
