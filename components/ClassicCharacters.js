'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from './AuthProvider';
import { classColor } from '@/lib/wow';
import { buildRuns, lastReset, weeklyRaidProgress } from '@/lib/progress';
import { timeAgo } from './ActivityFeed';

const day = (t) => new Date(t).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

// Progress → Classic: a table of characters you can click into, built from the addon's boss kills.
// (Same idea as the Retail tab, which gets its numbers from Blizzard instead.)
export default function ClassicCharacters({ dungeons, kills, lockouts, characters, bossesByDungeon }) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const weekStart = lastReset().getTime();
  const dungeonById = useMemo(() => Object.fromEntries(dungeons.map((d) => [d.id, d])), [dungeons]);
  const isRaid = (r) => dungeonById[r.dungeonId]?.kind === 'raid';

  // Every character's runs (a run counts for everyone who was there)
  const stats = useMemo(() => {
    const out = {};
    for (const c of characters) {
      const mine = kills.filter((k) => (k.character_ids ?? []).includes(c.id));
      const runs = buildRuns(mine, bossesByDungeon);
      const week = runs.filter((r) => r.end >= weekStart);
      out[c.id] = {
        runs,
        week,
        dungeonsWeek: week.filter((r) => !isRaid(r)).length,
        raidBossesWeek: week.filter(isRaid).reduce((s, r) => s + r.bosses.length, 0),
        dungeonsAll: runs.filter((r) => !isRaid(r)).length,
        raidsAll: runs.filter(isRaid).length,
        lastSeen: runs[0]?.end ?? null,
      };
    }
    return out;
  }, [characters, kills, bossesByDungeon, weekStart]); // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = [...characters].sort((a, b) =>
    (stats[b.id].dungeonsWeek + stats[b.id].raidBossesWeek) - (stats[a.id].dungeonsWeek + stats[a.id].raidBossesWeek)
    || stats[b.id].dungeonsAll - stats[a.id].dungeonsAll || b.level - a.level);
  const mineFirst = characters.find((c) => c.owner === userId && c.is_main) ?? characters.find((c) => c.owner === userId) ?? sorted[0];
  const [picked, setPicked] = useState(mineFirst?.id ?? null);

  if (!characters.length) return null;
  const sel = characters.find((c) => c.id === picked) ?? sorted[0];
  const s = stats[sel.id];
  const raids = weeklyRaidProgress({
    dungeons,
    kills: kills.filter((k) => (k.character_ids ?? []).includes(sel.id)),
    lockouts: lockouts.filter((l) => l.character_id === sel.id),
    bossesByDungeon,
  }).filter((r) => r.killed > 0);
  const weekDungeons = s.week.filter((r) => !isRaid(r));

  return (
    <>
      <section className="panel">
        <h2>Characters</h2>
        <div className="table-wrap">
          <table className="retail-table">
            <thead><tr><th>Character</th><th>Level</th><th>Dungeons this week</th><th>Raid bosses this week</th><th>All-time runs</th><th>Last run</th></tr></thead>
            <tbody>
              {sorted.map((c) => {
                const st = stats[c.id];
                return (
                  <tr key={c.id} className={`clickable ${sel.id === c.id ? 'picked' : ''}`} onClick={() => setPicked(c.id)}>
                    <td>
                      <strong style={{ color: classColor(c.class) }}>{c.name}</strong>
                      {c.owner === userId && <span className="badge gold" style={{ marginLeft: 6 }}>You</span>}
                      <div className="muted small">{c.profiles?.display_name}{c.realm ? ` · ${c.realm}` : ''}</div>
                    </td>
                    <td>{c.level}</td>
                    <td>{st.dungeonsWeek || <span className="muted">0</span>}</td>
                    <td>{st.raidBossesWeek || <span className="muted">0</span>}</td>
                    <td>{st.dungeonsAll + st.raidsAll ? <>{st.dungeonsAll} <span className="muted small">dungeons</span> · {st.raidsAll} <span className="muted small">raids</span></> : <span className="muted">—</span>}</td>
                    <td className="muted small">{st.lastSeen ? timeAgo(new Date(st.lastSeen).toISOString()) : 'never'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="row spread">
          <h2 style={{ color: classColor(sel.class) }}>
            {sel.name}<span className="muted small"> · level {sel.level} {sel.class}</span>
          </h2>
          <div className="row">
            <Link className="btn ghost small" href={`/characters/${sel.id}`}>Gear &amp; needs</Link>
            <Link className="btn ghost small" href="/logs">Logs</Link>
          </div>
        </div>

        <div className="stat-tiles">
          <div className="stat-tile"><span className="stat-num">{s.dungeonsWeek}</span><span className="stat-label">dungeons this week</span></div>
          <div className="stat-tile"><span className="stat-num">{s.raidBossesWeek}</span><span className="stat-label">raid bosses this week</span></div>
          <div className="stat-tile"><span className="stat-num">{s.dungeonsAll}</span><span className="stat-label">dungeon runs in total</span></div>
          <div className="stat-tile"><span className="stat-num">{s.raidsAll}</span><span className="stat-label">raid nights in total</span></div>
        </div>

        <h3>Dungeons this week</h3>
        {weekDungeons.length === 0 ? <p className="muted">No dungeon runs since the weekly reset.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Dungeon</th><th>Bosses</th><th>Result</th><th>When</th></tr></thead>
              <tbody>
                {weekDungeons.map((r) => {
                  const d = dungeonById[r.dungeonId];
                  return (
                    <tr key={`${r.key}-${r.start}`}>
                      <td>{d ? <Link href={`/dungeons/${d.id}`}><strong>{d.name}</strong></Link> : <strong>{r.instance ?? 'Unknown'}</strong>}</td>
                      <td>{r.bosses.length}{r.total ? `/${r.total}` : ''}</td>
                      <td>{r.fullClear ? <span className="badge ok-badge">✓ Full clear</span> : <span className="muted small">{r.bosses.slice(-2).join(', ')}</span>}</td>
                      <td className="muted small">{day(r.end)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <h3>Raids this week</h3>
        {raids.length === 0 ? <p className="muted">No raid bosses this week.</p> : (
          <div className="retail-modes">
            {raids.map((r) => (
              <div key={r.dungeon.id} className="retail-mode">
                <div className="row spread">
                  <Link href={`/dungeons/${r.dungeon.id}`}><strong>{r.dungeon.name}</strong></Link>
                  <span className="muted small">{r.killed}/{r.total}</span>
                </div>
                <div className="meter-bar"><span style={{ width: `${r.total ? (r.killed / r.total) * 100 : 0}%`, background: 'var(--accent)' }} /></div>
                <ul className="boss-ticks">
                  {r.bosses.map((b) => <li key={b.name} className={b.killed ? 'week' : ''}>{b.killed ? '✓' : '○'} {b.name}</li>)}
                </ul>
              </div>
            ))}
          </div>
        )}

        <h3>Recent runs</h3>
        {s.runs.length === 0 ? (
          <p className="muted">Nothing recorded yet. Runs show up here when someone in the group has the Solitude addon running.</p>
        ) : (
          <ul className="plain-list">
            {s.runs.slice(0, 8).map((r) => {
              const d = dungeonById[r.dungeonId];
              return (
                <li key={`${r.key}-${r.start}`} className="row spread" style={{ flexWrap: 'nowrap' }}>
                  <span>
                    <strong>{d?.name ?? r.instance ?? 'Unknown'}</strong>
                    {isRaid(r) && <span className="badge" style={{ marginLeft: 6 }}>Raid</span>}
                    <span className="muted small"> · {r.fullClear ? 'full clear' : `${r.bosses.length}${r.total ? `/${r.total}` : ''} bosses`}</span>
                  </span>
                  <span className="muted small">{day(r.end)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
