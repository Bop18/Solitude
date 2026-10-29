// ============================================================
// Works out, automatically, who an item is good for.
//
// - canUse():    can this class equip it? (armour type, weapon skill, class-only items)
// - itemScore(): how good is it for this class? Stats × rough per-class weights
// - bestFor():   the classes it suits best
// - upgradeFor(): is it better than what a character is wearing?
//
// These are rules of thumb, not a simulator. They're tuned to answer
// "is this roughly for me?" while levelling and in early raids.
// ============================================================

import { CLASS_NAMES } from './wow';

// ---------- What each class can equip ----------

const ARMOR = {
  Cloth: CLASS_NAMES,
  Leather: ['Druid', 'Hunter', 'Rogue', 'Shaman', 'Warrior', 'Paladin'],
  Mail: ['Hunter', 'Shaman', 'Warrior', 'Paladin'], // Hunter/Shaman from level 40
  Plate: ['Warrior', 'Paladin'],                     // from level 40
  Shield: ['Warrior', 'Paladin', 'Shaman'],
  Libram: ['Paladin'],
  Totem: ['Shaman'],
  Idol: ['Druid'],
};
const MAIL_AT_40 = ['Hunter', 'Shaman'];
const PLATE_AT_40 = ['Warrior', 'Paladin'];

// Weapon skills: "1H"/"2H" variants where it matters
const WEAPONS = {
  Warrior: ['Dagger', 'Fist Weapon', 'Axe', 'Axe2H', 'Mace', 'Mace2H', 'Sword', 'Sword2H', 'Polearm', 'Staff', 'Bow', 'Crossbow', 'Gun', 'Thrown'],
  Paladin: ['Axe', 'Axe2H', 'Mace', 'Mace2H', 'Sword', 'Sword2H', 'Polearm'],
  Hunter: ['Dagger', 'Fist Weapon', 'Axe', 'Axe2H', 'Sword', 'Sword2H', 'Polearm', 'Staff', 'Bow', 'Crossbow', 'Gun', 'Thrown'],
  Rogue: ['Dagger', 'Fist Weapon', 'Mace', 'Sword', 'Bow', 'Crossbow', 'Gun', 'Thrown'],
  Priest: ['Dagger', 'Mace', 'Staff', 'Wand'],
  Shaman: ['Dagger', 'Fist Weapon', 'Axe', 'Axe2H', 'Mace', 'Mace2H', 'Staff'],
  Mage: ['Dagger', 'Sword', 'Staff', 'Wand'],
  Warlock: ['Dagger', 'Sword', 'Staff', 'Wand'],
  Druid: ['Dagger', 'Fist Weapon', 'Mace', 'Mace2H', 'Staff'],
};
const DUAL_WIELD = ['Warrior', 'Rogue', 'Hunter'];

// The best armour type each class normally wants, by level
function idealArmor(cls, level) {
  if (['Mage', 'Priest', 'Warlock'].includes(cls)) return 'Cloth';
  if (['Rogue', 'Druid'].includes(cls)) return 'Leather';
  if (MAIL_AT_40.includes(cls)) return level >= 40 ? 'Mail' : 'Leather';
  if (PLATE_AT_40.includes(cls)) return level >= 40 ? 'Plate' : 'Mail';
  return 'Cloth';
}
const ARMOR_RANK = { Cloth: 0, Leather: 1, Mail: 2, Plate: 3 };

const isArmorPiece = (item) =>
  item.item_type in ARMOR_RANK && item.slot !== 'Back'; // every class wears cloth cloaks

function weaponKey(item) {
  const t = item.item_type;
  if (item.slot === 'Two-Hand' && ['Axe', 'Mace', 'Sword'].includes(t)) return `${t}2H`;
  return t;
}

/** Can this class equip the item (at this level)? */
export function canUse(cls, item, level = 60) {
  if (item.class_restrict?.length && !item.class_restrict.includes(cls)) return false;

  if (isArmorPiece(item)) {
    if (!ARMOR[item.item_type].includes(cls)) return false;
    if (item.item_type === 'Mail' && MAIL_AT_40.includes(cls) && level < 40) return false;
    if (item.item_type === 'Plate' && PLATE_AT_40.includes(cls) && level < 40) return false;
    return true;
  }
  if (['Shield', 'Libram', 'Totem', 'Idol'].includes(item.item_type)) return ARMOR[item.item_type].includes(cls);

  if (item.kind === 'Weapon') {
    if (item.item_type === 'Miscellaneous') return true;
    if (!WEAPONS[cls]?.includes(weaponKey(item))) return false;
    if (item.slot === 'Off Hand' && !DUAL_WIELD.includes(cls)) return false;
    return true;
  }
  return true; // rings, necks, trinkets, cloaks, held-in-off-hand
}

// ---------- How much each class values each stat ----------
// crit/hit are "per 1%". Weapon DPS is per point of DPS.

const W = {
  Warrior: { str: 2.0, agi: 1.3, sta: 0.9, ap: 1, crit: 22, hit: 20, def: 1.2, dodge: 10, parry: 10, block: 5, blockValue: 0.3, armor: 0.04, hp5: 1, meleeDps: 4.5, rangedDps: 0.4, spi: 0.1 },
  Paladin: { str: 1.6, agi: 0.8, sta: 0.9, int: 1.0, spi: 0.3, sp: 0.8, ap: 0.8, crit: 15, hit: 12, mp5: 2, def: 0.6, blockValue: 0.2, armor: 0.03, meleeDps: 3 },
  Hunter: { agi: 2.0, str: 0.3, sta: 0.8, int: 0.7, spi: 0.2, ap: 0.4, rap: 1, crit: 22, hit: 20, mp5: 1, armor: 0.02, meleeDps: 0.8, rangedDps: 5 },
  Rogue: { agi: 2.0, str: 1.1, sta: 0.8, ap: 1, crit: 22, hit: 22, dodge: 6, armor: 0.02, meleeDps: 4.5, rangedDps: 0.4 },
  Druid: { str: 1.2, agi: 1.3, sta: 0.9, int: 1.0, spi: 0.7, sp: 0.8, ap: 0.6, feralAp: 0.8, crit: 14, hit: 10, mp5: 1.8, armor: 0.03, def: 0.6 },
  Shaman: { str: 1.3, agi: 0.9, sta: 0.8, int: 1.0, spi: 0.4, sp: 0.9, ap: 0.7, crit: 15, hit: 12, mp5: 2, armor: 0.02, blockValue: 0.1, meleeDps: 3 },
  Mage: { int: 1.2, spi: 0.7, sta: 0.7, sp: 1.2, crit: 14, hit: 14, mp5: 1.5, armor: 0.005, wandDps: 1.5 },
  Warlock: { int: 1.0, spi: 0.6, sta: 1.0, sp: 1.2, crit: 10, hit: 14, mp5: 1.2, armor: 0.005, wandDps: 1.5 },
  Priest: { int: 1.2, spi: 1.1, sta: 0.7, sp: 1.0, crit: 10, hit: 8, mp5: 2, armor: 0.005, wandDps: 1.5 },
};
const PHYSICAL_ONLY = ['Warrior', 'Rogue', 'Hunter'];
const CASTER_ONLY = ['Mage', 'Warlock', 'Priest'];

// The data stores crit/hit as later-expansion "ratings"; Classic items give 1–2%.
const critPct = (r) => (r ? (r >= 20 ? Math.round(r / 14) : 1) : 0);
const hitPct = (r) => (r ? (r >= 15 ? Math.round(r / 10) : 1) : 0);
const pct = (r, per) => (r ? Math.max(1, Math.round(r / per)) : 0);

const STAT_KEYS = ['str', 'agi', 'sta', 'int', 'spi', 'sp', 'ap', 'rap', 'feralAp', 'mp5', 'hp5', 'def', 'dodge', 'parry', 'block', 'blockValue', 'crit', 'hit'];
const hasStats = (item) => STAT_KEYS.some((k) => item.stats?.[k]);

/**
 * How good the item is for a class. 0 = useless, higher = better.
 * includeDps: count weapon damage (true when comparing weapons you'd actually swing;
 * false when deciding who an item is "for", where the stats tell you more).
 */
export function itemScore(cls, item, { includeDps = true } = {}) {
  if (!item) return 0;
  const w = W[cls];
  const s = item.stats ?? {};
  if (!w) return 0;

  // Is the item's crit/hit "physical" or "spell"? Decide from its other stats.
  const caster = (s.int || s.sp || s.mp5 || s.spi) && !(s.str || s.agi || s.ap || s.rap);
  const physical = (s.str || s.agi || s.ap || s.rap) && !(s.int || s.sp || s.mp5);
  let critW = w.crit ?? 0;
  let hitW = w.hit ?? 0;
  if (caster && PHYSICAL_ONLY.includes(cls)) critW = hitW = 0;
  if (physical && CASTER_ONLY.includes(cls)) critW = hitW = 0;

  let score =
    (s.str ?? 0) * (w.str ?? 0) +
    (s.agi ?? 0) * (w.agi ?? 0) +
    (s.sta ?? 0) * (w.sta ?? 0) +
    (s.int ?? 0) * (w.int ?? 0) +
    (s.spi ?? 0) * (w.spi ?? 0) +
    (s.sp ?? 0) * (w.sp ?? 0) +
    (s.ap ?? 0) * (w.ap ?? 0) +
    (s.rap ?? 0) * (w.rap ?? 0) +
    (s.feralAp ?? 0) * (w.feralAp ?? 0) +
    (s.mp5 ?? 0) * (w.mp5 ?? 0) +
    (s.hp5 ?? 0) * (w.hp5 ?? 0) +
    (s.def ?? 0) * (w.def ?? 0) / 1.5 +
    pct(s.dodge, 12) * (w.dodge ?? 0) +
    pct(s.parry, 20) * (w.parry ?? 0) +
    pct(s.block, 5) * (w.block ?? 0) +
    (s.blockValue ?? 0) * (w.blockValue ?? 0) +
    critPct(s.crit) * critW +
    hitPct(s.hit) * hitW +
    (s.armor ?? 0) * (w.armor ?? 0);

  // Weapon damage
  if (item.dps && includeDps) {
    if (item.item_type === 'Wand') score += item.dps * (w.wandDps ?? 0);
    else if (['Bow', 'Gun', 'Crossbow', 'Thrown'].includes(item.item_type)) score += item.dps * (w.rangedDps ?? 0);
    else score += item.dps * (w.meleeDps ?? 0) * (item.slot === 'Two-Hand' ? 1 : 1.15);
  }

  // Wearing a lighter armour type than you'd like is a small step down
  if (isArmorPiece(item)) {
    const ideal = idealArmor(cls, item.req_level ?? 60);
    if (ARMOR_RANK[item.item_type] < ARMOR_RANK[ideal]) score *= 0.8;
  }
  return Math.round(score * 10) / 10;
}

/** The classes an item suits best, best first. */
export function bestFor(item) {
  if (item._bestFor) return item._bestFor; // cached
  const level = Math.max(item.req_level ?? 60, 1);
  // Stats decide; weapon damage only counts if there are no stats,
  // except bows/guns/crossbows where the damage is the whole point (Hunters).
  const includeDps = !hasStats(item) || ['Bow', 'Gun', 'Crossbow'].includes(item.item_type);
  const scored = CLASS_NAMES
    .filter((c) => canUse(c, item, Math.max(level, 40)))
    .map((c) => ({ cls: c, score: itemScore(c, item, { includeDps }) }));
  const result = rankClasses(scored, item);
  Object.defineProperty(item, '_bestFor', { value: result, enumerable: false, configurable: true });
  return result;
}

function rankClasses(scored, item) {
  if (!scored.length) return [];

  const max = Math.max(...scored.map((x) => x.score));
  if (max <= 0) {
    // No useful stats (plain armour): give it to the classes for whom it's their armour type
    if (isArmorPiece(item)) {
      return scored.filter((x) => idealArmor(x.cls, 60) === item.item_type).map((x) => x.cls);
    }
    return [];
  }
  return scored
    .filter((x) => x.score >= max * 0.7)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.cls);
}

// ---------- Upgrades ----------

// Which gear slots an item would go into
export function gearSlotsFor(item, cls) {
  switch (item.slot) {
    case 'Finger': return ['Finger 1', 'Finger 2'];
    case 'Trinket': return ['Trinket 1', 'Trinket 2'];
    case 'One-Hand': return DUAL_WIELD.includes(cls) ? ['Main Hand', 'Off Hand'] : ['Main Hand'];
    case 'Two-Hand':
    case 'Main Hand': return ['Main Hand'];
    case 'Off Hand':
    case 'Held In Off-hand': return ['Off Hand'];
    case 'Ranged':
    case 'Relic':
    case 'Thrown': return ['Ranged'];
    default: return [item.slot];
  }
}

/**
 * Is `item` an upgrade for `character`?
 * gear: { [gearSlot]: { items: {...} | null, item_name } }
 * Returns null if not usable/not better, otherwise
 * { slot, gain (0.15 = 15% better), replaces (item or null), unknown (true if current item isn't in our data) }
 */
export function upgradeFor(character, item, gear = {}) {
  const cls = character.class;
  if (!canUse(cls, item, character.level)) return null;
  // Only suggest items that are actually meant for this class
  // (stops e.g. a Warrior being told to take a caster staff for its damage)
  if (!bestFor(item).includes(cls)) return null;
  const newScore = itemScore(cls, item);
  if (newScore <= 0) return null;

  // Already wearing it?
  const slots = gearSlotsFor(item, cls);
  if (slots.some((sl) => gear[sl]?.items?.game_id && gear[sl].items.game_id === item.game_id)) return null;

  // Compare with the weakest of the slots it could go in
  let best = null;
  for (const sl of slots) {
    const row = gear[sl];
    let current = row?.items ?? null;
    let currentScore = current ? itemScore(cls, current) : 0;

    // A two-hander replaces main hand + off hand
    if (item.slot === 'Two-Hand' && gear['Off Hand']?.items) {
      currentScore += itemScore(cls, gear['Off Hand'].items);
    }
    // A one-hander can't replace a two-hander on its own; compare against half of it
    if (item.slot !== 'Two-Hand' && sl === 'Main Hand' && current?.slot === 'Two-Hand') {
      currentScore = currentScore / 2;
    }

    const unknown = !!row && !current; // typed in by hand, so we don't know its stats
    if (unknown) {
      if (!best) best = { slot: sl, gain: null, replaces: null, unknown: true, score: newScore };
      continue;
    }
    if (newScore > currentScore * 1.05) {
      const gain = currentScore > 0 ? (newScore - currentScore) / currentScore : null; // null = empty slot
      if (!best || best.unknown || (gain ?? 99) > (best.gain ?? 99)) {
        best = { slot: sl, gain, replaces: current, unknown: false, score: newScore };
      }
    }
  }
  return best;
}

/** Keep the best N per gear slot so suggestions cover the whole character, not 7 weapons. */
export function spreadAcrossSlots(list, perSlot = 1, slotOf = (x) => x.u.slot) {
  const seen = {};
  return list.filter((x) => {
    const s = slotOf(x);
    seen[s] = (seen[s] ?? 0) + 1;
    return seen[s] <= perSlot;
  });
}

/** "+6 Agi · +3 Sta · 1% Crit" style summary for tables */
const LABELS = [
  ['str', 'Str'], ['agi', 'Agi'], ['sta', 'Sta'], ['int', 'Int'], ['spi', 'Spi'],
  ['sp', 'Spell Power'], ['ap', 'AP'], ['rap', 'Ranged AP'], ['feralAp', 'Feral AP'],
  ['mp5', 'MP5'], ['hp5', 'HP5'], ['def', 'Def'],
];
export function statSummary(item) {
  const s = item.stats ?? {};
  const parts = LABELS.filter(([k]) => s[k]).map(([k, l]) => `+${s[k]} ${l}`);
  if (s.crit) parts.push(`${critPct(s.crit)}% Crit`);
  if (s.hit) parts.push(`${hitPct(s.hit)}% Hit`);
  if (s.dodge) parts.push(`${pct(s.dodge, 12)}% Dodge`);
  if (s.parry) parts.push(`${pct(s.parry, 20)}% Parry`);
  if (s.block) parts.push(`${pct(s.block, 5)}% Block`);
  if (item.dps) parts.push(`${item.dps} DPS`);
  const res = ['fireRes', 'frostRes', 'shadowRes', 'natureRes', 'arcaneRes'].filter((k) => s[k]);
  for (const k of res) parts.push(`+${s[k]} ${k.replace('Res', '')} Res`);
  return parts.join(' · ');
}
