// ============================================================
// Turns boss kills + raid lockouts into "runs", weekly raid
// progress and counts for the Progress page and dashboard.
// ============================================================

import { WEEKLY_RESET } from './site';

const RUN_GAP_MS = 3 * 60 * 60 * 1000; // kills in the same place within 3 hours = one run

/** The most recent weekly reset at or before `now`. */
export function lastReset(now = new Date(), reset = WEEKLY_RESET) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), reset.hourUTC));
  const back = (d.getUTCDay() - reset.day + 7) % 7;
  d.setUTCDate(d.getUTCDate() - back);
  if (d > now) d.setUTCDate(d.getUTCDate() - 7);
  return d;
}
export const nextReset = (now = new Date()) => new Date(lastReset(now).getTime() + 7 * 86400000);

/** Boss names per dungeon, roughly in dungeon order (from the loot data). */
export function bossOrder(items) {
  const byDungeon = {};
  for (const i of items) {
    if (!i.boss || !i.dungeon_id) continue;
    const d = (byDungeon[i.dungeon_id] ??= {});
    const b = (d[i.boss] ??= { sum: 0, n: 0 });
    b.sum += i.ilvl ?? 0;
    b.n += 1;
  }
  const out = {};
  for (const [id, bosses] of Object.entries(byDungeon)) {
    out[id] = Object.entries(bosses)
      .sort((a, b) => a[1].sum / a[1].n - b[1].sum / b[1].n)
      .map(([name]) => name);
  }
  return out;
}

const same = (a, b) => a.toLowerCase() === b.toLowerCase();

/**
 * Group kills into runs: same dungeon, kills within 3 hours of each other.
 * Returns newest first: { dungeonId, start, end, bosses: [names], characterIds: Set, fullClear }
 */
export function buildRuns(kills, bossesByDungeon = {}) {
  const sorted = [...kills].sort((a, b) => new Date(a.killed_at) - new Date(b.killed_at));
  const open = {}; // dungeonKey → current run
  const runs = [];
  for (const k of sorted) {
    const key = k.dungeon_id ?? `?${k.instance ?? k.boss}`;
    const t = new Date(k.killed_at).getTime();
    let run = open[key];
    if (!run || t - run.end > RUN_GAP_MS) {
      run = { key, dungeonId: k.dungeon_id ?? null, instance: k.instance, start: t, end: t, bosses: [], characterIds: new Set(), kills: [] };
      open[key] = run;
      runs.push(run);
    }
    run.end = t;
    if (!run.bosses.some((b) => same(b, k.boss))) run.bosses.push(k.boss);
    for (const id of k.character_ids ?? []) run.characterIds.add(id);
    run.kills.push(k);
  }
  for (const r of runs) {
    const order = bossesByDungeon[r.dungeonId] ?? [];
    const last = order[order.length - 1];
    r.total = order.length || null;
    r.fullClear = !!last && r.bosses.some((b) => same(b, last));
  }
  return runs.reverse();
}

/**
 * This week's progress in each raid.
 * Combines kills since the reset with lockouts the game reported (for bosses killed
 * before anyone had the addon, or by someone not running the companion).
 * Returns [{ dungeon, bosses: [{ name, killed, killedAt }], killed, total }]
 */
export function weeklyRaidProgress({ dungeons, kills, lockouts, bossesByDungeon, now = new Date() }) {
  const since = lastReset(now);
  const result = [];
  for (const d of dungeons.filter((x) => x.kind === 'raid')) {
    // The game's own lockout list is in real encounter order, so prefer it
    const gameList = lockouts
      .filter((l) => l.dungeon_id === d.id && new Date(l.resets_at) > now)
      .map((l) => (l.bosses ?? []).map((b) => b?.name).filter(Boolean))
      .sort((a, b) => b.length - a.length)[0] ?? [];
    const order = [...gameList];
    for (const b of bossesByDungeon[d.id] ?? []) if (!order.some((x) => same(x, b))) order.push(b);
    const killedAt = {};
    for (const k of kills) {
      if (k.dungeon_id !== d.id || new Date(k.killed_at) < since) continue;
      const name = order.find((b) => same(b, k.boss)) ?? k.boss;
      if (!order.some((b) => same(b, name))) order.push(name);
      if (!killedAt[name] || new Date(k.killed_at) < killedAt[name]) killedAt[name] = new Date(k.killed_at);
    }
    for (const l of lockouts) {
      if (l.dungeon_id !== d.id || new Date(l.resets_at) <= now) continue;
      for (const b of l.bosses ?? []) {
        if (!b?.name) continue;
        const name = order.find((x) => same(x, b.name)) ?? b.name;
        if (!order.some((x) => same(x, name))) order.push(name);
        if (b.killed && !killedAt[name]) killedAt[name] = true;
      }
    }
    const bosses = order.map((name) => ({ name, killed: !!killedAt[name], killedAt: killedAt[name] instanceof Date ? killedAt[name] : null }));
    const killed = bosses.filter((b) => b.killed).length;
    result.push({ dungeon: d, bosses, killed, total: bosses.length });
  }
  // Raids you've started this week first, then the rest
  return result.sort((a, b) => (b.killed > 0) - (a.killed > 0) || (a.dungeon.min_level ?? 0) - (b.dungeon.min_level ?? 0));
}

/** Runs per player (via the characters that were there). */
export function runsPerPlayer(runs, characters) {
  const ownerOf = Object.fromEntries(characters.map((c) => [c.id, c.owner]));
  const counts = {};
  for (const r of runs) {
    const owners = new Set([...r.characterIds].map((id) => ownerOf[id]).filter(Boolean));
    for (const o of owners) counts[o] = (counts[o] ?? 0) + 1;
  }
  return counts;
}
