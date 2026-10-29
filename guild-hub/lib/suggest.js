// ============================================================
// "What should we run?" Picks the best dungeon for a set of
// characters by counting how many real upgrades drop there.
// ============================================================

import { supabase } from './supabase';
import { upgradeFor } from './itemScore';

/** Supabase returns at most 1000 rows per request; page through when needed. */
export async function fetchAll(build, { pageSize = 1000, maxPages = 4 } = {}) {
  const rows = [];
  for (let page = 0; page < maxPages; page++) {
    const { data, error } = await build().range(page * pageSize, page * pageSize + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

/** Each player's main: their is_main character, or their highest level one. */
export function mainsByOwner(characters) {
  const out = {};
  for (const c of [...characters].sort((a, b) => (b.is_main - a.is_main) || (b.level - a.level))) {
    if (!(c.owner in out)) out[c.owner] = c;
  }
  return out;
}

/** Dungeon loot that could matter for characters in this level range. */
export async function itemsForLevels(minLevel, maxLevel) {
  return fetchAll(() =>
    supabase
      .from('items')
      .select('*')
      .not('dungeon_id', 'is', null)
      .gte('req_level', Math.max(1, minLevel - 10))
      .lte('req_level', maxLevel + 2));
}

/**
 * Rank dungeons by how many upgrades they hold for these characters.
 * characters: [{ id, name, class, level, character_gear: [{ slot, items }] }]
 * Returns [{ dungeon, total, perChar: [{ char, count, best }] }] best first.
 */
export function rankDungeons({ characters, items, dungeons, includeRaids = false }) {
  const avg = characters.reduce((s, c) => s + c.level, 0) / (characters.length || 1);
  const gearOf = Object.fromEntries(characters.map((c) => [c.id, Object.fromEntries((c.character_gear ?? []).map((g) => [g.slot, g]))]));
  const results = [];
  for (const d of dungeons) {
    if (d.kind === 'raid' && !includeRaids) continue;
    // Roughly the right level for this group?
    if (d.min_level && d.min_level > avg + 3) continue;
    if (d.max_level && d.max_level < avg - 4 && d.max_level < 60) continue;
    const loot = items.filter((i) => i.dungeon_id === d.id);
    if (!loot.length) continue;
    const perChar = [];
    for (const c of characters) {
      let count = 0;
      let best = null;
      for (const item of loot) {
        if (item.req_level && item.req_level > c.level + 1) continue;
        const u = upgradeFor(c, item, gearOf[c.id]);
        if (!u || u.unknown) continue;
        if (u.gain == null && item.req_level && c.level > item.req_level + 12) continue; // over-levelled, slot just not entered
        count += 1;
        if (!best || (u.gain ?? 0.5) > (best.u.gain ?? 0.5)) best = { item, u };
      }
      if (count) perChar.push({ char: c, count, best });
    }
    const total = perChar.reduce((s, p) => s + p.count, 0);
    if (total) results.push({ dungeon: d, total, perChar: perChar.sort((a, b) => b.count - a.count) });
  }
  // Prefer dungeons that help more people, then more upgrades overall
  return results.sort((a, b) => (b.perChar.length - a.perChar.length) || (b.total - a.total));
}
