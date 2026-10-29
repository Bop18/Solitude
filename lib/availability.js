// Helpers for the hourly availability page.

export const HOURS = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]; // 24/25 = midnight/1am that night
export const hourLabel = (h) => `${String(h % 24).padStart(2, '0')}:00`;

/** Is this hour good enough for a 5-player dungeon? (a tank, a healer, 5 people) */
export function groupReady(players) {
  return missing(players).length === 0;
}

/** What's missing for a dungeon group, e.g. ['a tank', '2 more people'] */
export function missing(players) {
  const roles = players.map((p) => p.role);
  const out = [];
  if (!roles.includes('tank')) out.push('a tank');
  if (!roles.includes('healer')) out.push('a healer');
  const short = 5 - players.length;
  if (short > 0) out.push(`${short} more ${short === 1 ? 'person' : 'people'}`);
  return out;
}

/**
 * Turn the grid into the best blocks of 2+ consecutive hours.
 * free: { "day-hour": [players] }
 * Returns [{ day, from, to, min, ready, names }] best first.
 */
export function bestBlocks(free, { minPlayers = 3, limit = 4 } = {}) {
  const blocks = [];
  for (let day = 0; day < 7; day++) {
    let cur = null;
    for (const h of [...HOURS, 99]) {
      const players = free[`${day}-${h}`] ?? [];
      const ready = groupReady(players);
      if (cur && h !== 99 && players.length >= minPlayers && ready !== cur.ready) {
        // Group-ready status changes here: end this block and start a new one
        if (cur.to - cur.from >= 2) blocks.push({ ...cur, names: [...cur.names] });
        cur = null;
      }
      if (h !== 99 && players.length >= minPlayers) {
        if (!cur) cur = { day, from: h, to: h + 1, min: players.length, ready, missing: missing(players), names: new Set(players.map((p) => p.name)) };
        else {
          cur.to = h + 1;
          // Report what's missing at the weakest hour of the block
          if (players.length < cur.min) cur.missing = missing(players);
          cur.min = Math.min(cur.min, players.length);
          // Only keep people free for the whole block
          cur.names = new Set([...cur.names].filter((n) => players.some((p) => p.name === n)));
        }
      } else if (cur) {
        if (cur.to - cur.from >= 2) blocks.push({ ...cur, names: [...cur.names] });
        cur = null;
      }
    }
  }
  return blocks
    .sort((a, b) => (b.ready - a.ready) || (b.min - a.min) || ((b.to - b.from) - (a.to - a.from)))
    .slice(0, limit);
}

/** The next date (local time) for a weekday (0 = Mon) and hour (24/25 = after midnight). */
export function nextDate(day, hour, now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const today = (d.getDay() + 6) % 7; // JS: 0 = Sunday → our 0 = Monday
  let add = (day - today + 7) % 7;
  d.setDate(d.getDate() + add);
  d.setHours(hour % 24, 0, 0, 0);
  if (hour >= 24) d.setDate(d.getDate() + 1);
  if (d < now) d.setDate(d.getDate() + 7);
  return d;
}

/** "2026-11-04T19:00" for the event form's date-time box */
export function toLocalInput(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
