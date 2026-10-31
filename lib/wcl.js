// ============================================================
// Warcraft Logs: reading a report link and turning the API's
// answer into a small summary we keep in our own database.
// ============================================================

/**
 * "https://classic.warcraftlogs.com/reports/AbC123xYz#fight=5&type=damage-done"
 * → { code: 'AbC123xYz', host: 'classic.warcraftlogs.com', fight: 5 }
 * Returns null if it isn't a Warcraft Logs report link.
 */
export function parseReportUrl(text) {
  const raw = String(text ?? '').trim();
  let url;
  try { url = new URL(raw.startsWith('http') ? raw : `https://${raw}`); } catch { return null; }
  if (!/(^|\.)warcraftlogs\.com$/i.test(url.hostname)) return null;
  const m = url.pathname.match(/\/reports\/([A-Za-z0-9]{8,32})/);
  if (!m) return null;
  const fight = Number(new URLSearchParams(url.hash.replace(/^#/, '')).get('fight') ?? url.searchParams.get('fight'));
  return { code: m[1], host: url.hostname.toLowerCase(), fight: Number.isFinite(fight) && fight > 0 ? fight : null };
}

const tableData = (t) => (t?.data ?? t ?? {});

/** [{ id, total }] from a DamageDone / Healing table, biggest first. */
function amounts(table) {
  const d = tableData(table);
  return (d.entries ?? [])
    .filter((e) => e && e.total > 0)
    .map((e) => ({ id: e.id, total: Math.round(e.total), active: e.activeTime ? Math.round(e.activeTime) : undefined }))
    .sort((a, b) => b.total - a.total);
}

/** [{ id, at (ms into the fight), by (ability), killer }] from a Deaths table. */
function deaths(table, fightStart = 0, fightsById = {}) {
  const d = tableData(table);
  return (d.entries ?? []).map((e) => {
    const f = fightsById[e.fight];
    const start = f ? f.startTime : fightStart;
    return {
      id: e.id,
      at: Math.max(0, Math.round((e.deathTime ?? e.timestamp ?? start) - start)),
      by: e.ability?.name ?? e.killingBlow?.ability?.name ?? null,
      killer: e.killingBlow?.name ?? e.killer?.name ?? null,
      fight: e.fight ?? undefined,
    };
  });
}

/**
 * Build our summary from the report metadata + the tables we asked for.
 * report: { title, startTime, endTime, zone, owner, fights, masterData }
 * tables: { all_d, all_h, all_x, f12_d, f12_h, f12_x, … }
 */
export function buildSummary(report, tables, { host } = {}) {
  const fights = report.fights ?? [];
  const fightsById = Object.fromEntries(fights.map((f) => [f.id, f]));
  const players = (report.masterData?.actors ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    class: a.subType ?? null,
    spec: typeof a.icon === 'string' && a.icon.includes('-') ? a.icon.split('-').slice(1).join(' ') : null,
    server: a.server ?? null,
  }));
  const bosses = fights
    .filter((f) => f.encounterID > 0)
    .map((f) => ({
      id: f.id,
      name: f.name,
      kill: !!f.kill,
      start: f.startTime,
      duration: Math.max(0, f.endTime - f.startTime),
      pct: f.kill ? 0 : f.fightPercentage != null ? Math.round(f.fightPercentage) / 100 : null, // boss health left (%)
      size: f.size ?? null,
      players: f.friendlyPlayers ?? [],
      damage: amounts(tables[`f${f.id}_d`]),
      healing: amounts(tables[`f${f.id}_h`]),
      deaths: deaths(tables[`f${f.id}_x`], f.startTime),
      time: Math.round(tableData(tables[`f${f.id}_d`]).totalTime ?? (f.endTime - f.startTime)),
    }));
  // Report-wide (trash included)
  const overall = {
    damage: amounts(tables.all_d),
    healing: amounts(tables.all_h),
    deaths: deaths(tables.all_x, 0, fightsById),
    time: Math.round(tableData(tables.all_d).totalTime ?? (report.endTime - report.startTime)),
  };
  // Only keep players who actually did something
  const active = new Set([...overall.damage, ...overall.healing, ...overall.deaths].map((x) => x.id));
  bosses.forEach((b) => b.players.forEach((id) => active.add(id)));
  return {
    v: 1,
    host: host ?? null,
    title: report.title ?? null,
    zone: report.zone?.name ?? null,
    owner: report.owner?.name ?? null,
    start: report.startTime ?? null,
    end: report.endTime ?? null,
    players: players.filter((p) => active.has(p.id)),
    bosses,
    overall,
    fightCount: fights.length,
  };
}

/** 125000 → "2:05" */
export function clock(ms) {
  const s = Math.max(0, Math.round((ms ?? 0) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** 1234567 → "1.23M", 45678 → "45.7k" */
export function short(n) {
  if (n == null) return '—';
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}k`;
  return String(Math.round(n));
}
