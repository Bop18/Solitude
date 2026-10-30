// ============================================================
// "What should we run?" Picks the best dungeon for a set of
// characters by counting how many real upgrades drop there.
// ============================================================

import { supabase } from './supabase';
import { upgradeFor } from './itemScore';
import { cached } from './cache';

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

/** All dungeons and raids (rarely change: cached for 10 minutes). */
export function loadDungeons() {
  return cached('dungeons', async () => {
    const { data, error } = await supabase.from('dungeons').select('*').order('min_level', { nullsFirst: false });
    if (error) throw error;
    return data ?? [];
  }, 600_000);
}

/** Everyone's characters with their worn gear (shared by the dashboard cards). */
export function loadCharactersWithGear() {
  return cached('chars:gear', async () => {
    const { data, error } = await supabase
      .from('characters')
      .select('id, name, class, level, role, owner, is_main, synced_at, character_gear(slot, item_name, items(*))');
    if (error) throw error;
    return data ?? [];
  }, 120_000);
}

// Loot per dungeon, fetched once per dungeon and then reused.
const lootByDungeon = new Map(); // dungeon id → Promise<items[]>

/** Loot for these dungeons, only fetching the ones we haven't loaded yet. */
export async function itemsForDungeons(ids) {
  const missing = ids.filter((id) => !lootByDungeon.has(id));
  if (missing.length) {
    const all = fetchAll(() => supabase.from('items').select('*').in('dungeon_id', missing).order('id'), { maxPages: 10 });
    for (const id of missing) lootByDungeon.set(id, all.then((rows) => rows.filter((r) => r.dungeon_id === id)));
    all.catch(() => missing.forEach((id) => lootByDungeon.delete(id)));
  }
  return (await Promise.all(ids.map((id) => lootByDungeon.get(id)))).flat();
}

/** Dungeons a group in this level range would run (raids only at 60). */
export function dungeonsForLevels(dungeons, minLevel, maxLevel) {
  return dungeons.filter((d) =>
    (!d.min_level || d.min_level <= maxLevel + 3) &&
    (!d.max_level || d.max_level >= minLevel - 4 || (maxLevel >= 58 && d.max_level >= 60)));
}

/** Dungeon loot that could matter for characters in this level range. */
export async function itemsForLevels(minLevel, maxLevel) {
  const dungeons = dungeonsForLevels(await loadDungeons(), minLevel, maxLevel);
  const items = await itemsForDungeons(dungeons.map((d) => d.id));
  return items.filter((i) => !i.req_level || (i.req_level >= minLevel - 10 && i.req_level <= maxLevel + 2));
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
