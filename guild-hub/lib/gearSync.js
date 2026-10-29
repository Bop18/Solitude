// ============================================================
// Puts a character's real, in-game gear and level onto the site.
// Used by both the Battle.net sync and the in-game addon import.
// ============================================================

// In-game inventory slot number → our gear slot name
export const INVENTORY_SLOTS = {
  1: 'Head', 2: 'Neck', 3: 'Shoulder', 15: 'Back', 5: 'Chest', 9: 'Wrist',
  10: 'Hands', 6: 'Waist', 7: 'Legs', 8: 'Feet', 11: 'Finger 1', 12: 'Finger 2',
  13: 'Trinket 1', 14: 'Trinket 2', 16: 'Main Hand', 17: 'Off Hand', 18: 'Ranged',
};

// Blizzard API slot type → our gear slot name
export const BLIZZARD_SLOTS = {
  HEAD: 'Head', NECK: 'Neck', SHOULDER: 'Shoulder', BACK: 'Back', CHEST: 'Chest',
  WRIST: 'Wrist', HANDS: 'Hands', WAIST: 'Waist', LEGS: 'Legs', FEET: 'Feet',
  FINGER_1: 'Finger 1', FINGER_2: 'Finger 2', TRINKET_1: 'Trinket 1', TRINKET_2: 'Trinket 2',
  MAIN_HAND: 'Main Hand', OFF_HAND: 'Off Hand', RANGED: 'Ranged',
};

export const QUALITY_BY_NUMBER = ['poor', 'common', 'uncommon', 'rare', 'epic', 'legendary'];
export const QUALITY_BY_BLIZZARD = {
  POOR: 'poor', COMMON: 'common', UNCOMMON: 'uncommon', RARE: 'rare', EPIC: 'epic', LEGENDARY: 'legendary',
};
const OUR_QUALITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export const CLASS_TOKENS = {
  WARRIOR: 'Warrior', PALADIN: 'Paladin', HUNTER: 'Hunter', ROGUE: 'Rogue', PRIEST: 'Priest',
  SHAMAN: 'Shaman', MAGE: 'Mage', WARLOCK: 'Warlock', DRUID: 'Druid',
};

// "Pyrewood Village" → "pyrewood-village", "Zul'jin" → "zuljin" (Blizzard API realm names)
export function realmSlug(realm) {
  return realm.trim().toLowerCase().replace(/['’]/g, '').replace(/\s+/g, '-');
}

// Best guess at the item's slot if we've never seen it (e.g. brand-new WoW: Forever loot)
const ITEM_SLOT_FOR_GEAR = {
  'Finger 1': 'Finger', 'Finger 2': 'Finger', 'Trinket 1': 'Trinket', 'Trinket 2': 'Trinket',
  'Main Hand': 'Main Hand', 'Off Hand': 'Off Hand', Ranged: 'Ranged',
};

/**
 * Parse the text the in-game addon gives you.
 * Format: SOL1^Name^Realm^Level^CLASS^Race;slot^itemId^quality^ilvl^Item Name;...
 * Returns { name, realm, level, className, race, items: [{ slot, gameId, name, quality, ilvl }] }
 * or throws an Error with a friendly message.
 */
export function parseAddonExport(text) {
  const clean = (text ?? '').trim().replace(/\s*\n\s*/g, '');
  if (!clean.startsWith('SOL1^')) {
    throw new Error("That doesn't look like Solitude addon text. In game, type /solitude and copy everything in the box.");
  }
  const [header, ...rest] = clean.split(';');
  const [, name, realm, level, classToken, race] = header.split('^');
  const lvl = Number(level);
  if (!name || !Number.isFinite(lvl)) throw new Error('The addon text is incomplete. Copy it again.');

  const items = [];
  for (const part of rest) {
    if (!part) continue;
    const [slotNum, id, quality, ilvl, ...nameParts] = part.split('^');
    const slot = INVENTORY_SLOTS[Number(slotNum)];
    const gameId = Number(id);
    if (!slot || !gameId) continue;
    items.push({
      slot,
      gameId,
      name: nameParts.join('^') || `Item ${gameId}`,
      quality: quality === '' || quality == null ? null : QUALITY_BY_NUMBER[Number(quality)] ?? null,
      ilvl: Number(ilvl) || null,
    });
  }
  return { name, realm, level: lvl, className: CLASS_TOKENS[classToken] ?? null, race: race || null, items };
}

/**
 * Save a character's equipped items and level.
 * supabase: a client acting as the character's owner (so the database security rules apply).
 * Replaces all gear slots: slots that are empty in game become empty on the site too.
 * Returns { equipped, newItems }.
 */
export async function applySync(supabase, characterId, { level, items, source }) {
  const ids = [...new Set(items.map((i) => i.gameId))];

  // Which items do we already know (with stats and icons)?
  const known = {};
  if (ids.length) {
    const { data, error } = await supabase.from('items').select('id, game_id, name').in('game_id', ids);
    if (error) throw error;
    for (const row of data) known[row.game_id] = row;
  }

  // Unknown items (e.g. new WoW: Forever loot): add them with what we know
  const missing = items.filter((i) => !known[i.gameId]);
  const seen = new Set();
  const toCreate = missing
    .filter((i) => (seen.has(i.gameId) ? false : seen.add(i.gameId)))
    .map((i) => ({
      game_id: i.gameId,
      name: i.name,
      quality: OUR_QUALITIES.includes(i.quality) ? i.quality : 'common',
      ilvl: i.ilvl ?? null,
      slot: ITEM_SLOT_FOR_GEAR[i.slot] ?? i.slot,
      link: `https://www.wowhead.com/classic/item=${i.gameId}`,
    }));
  if (toCreate.length) {
    const { data, error } = await supabase.from('items').upsert(toCreate, { onConflict: 'game_id' }).select('id, game_id, name');
    if (error) throw error;
    for (const row of data) known[row.game_id] = row;
  }

  // Replace the gear
  const { error: delErr } = await supabase.from('character_gear').delete().eq('character_id', characterId);
  if (delErr) throw delErr;
  const now = new Date().toISOString();
  const rows = items.map((i) => ({
    character_id: characterId,
    slot: i.slot,
    item_id: known[i.gameId]?.id ?? null,
    item_name: known[i.gameId]?.name ?? i.name,
    updated_at: now,
  }));
  if (rows.length) {
    const { error } = await supabase.from('character_gear').insert(rows);
    if (error) throw error;
  }

  // Wearing something you'd marked as Need? Record it as received
  // (ticks it off and posts "X got [item]" to the activity feed).
  const wornIds = rows.map((r) => r.item_id).filter(Boolean);
  let received = 0;
  if (wornIds.length) {
    const { data: open } = await supabase
      .from('wishlist')
      .select('item_id')
      .eq('character_id', characterId)
      .eq('obtained', false)
      .in('item_id', wornIds);
    if (open?.length) {
      const { error } = await supabase
        .from('loot_history')
        .insert(open.map((w) => ({ item_id: w.item_id, character_id: characterId, note: `Seen equipped (${source})` })));
      if (!error) received = open.length;
    }
  }

  // Level + when it was synced
  const update = { synced_at: now, sync_source: source, updated_at: now };
  if (Number.isFinite(level) && level > 0) update.level = level;
  const { error: upErr } = await supabase.from('characters').update(update).eq('id', characterId);
  if (upErr) throw upErr;

  return { equipped: rows.length, newItems: toCreate.length, received };
}
