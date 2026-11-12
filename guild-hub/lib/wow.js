// Game data the site uses. WoW: Forever is a "reimagined" Classic, so if it
// adds or changes classes, just edit this list.

// Class colours are CSS variables (defined in app/globals.css) so they can be
// a little deeper in light mode, where pale colours like Priest white or Rogue
// yellow would be unreadable.
export const CLASSES = {
  Druid: 'var(--class-druid)',
  Hunter: 'var(--class-hunter)',
  Mage: 'var(--class-mage)',
  Paladin: 'var(--class-paladin)',
  Priest: 'var(--class-priest)',
  Rogue: 'var(--class-rogue)',
  Shaman: 'var(--class-shaman)',
  Warlock: 'var(--class-warlock)',
  Warrior: 'var(--class-warrior)',
};

export const CLASS_NAMES = Object.keys(CLASSES);

export const RACES = [
  'Human', 'Dwarf', 'Night Elf', 'Gnome',
  'Orc', 'Undead', 'Tauren', 'Troll',
  'Skyborne', // WoW: Forever's elves (Alliance: High Order, Horde: Windshaper)
];

export const ROLES = {
  tank: { label: 'Tank', icon: '🛡️' },
  healer: { label: 'Healer', icon: '✚' },
  dps: { label: 'DPS', icon: '⚔️' },
};

export const MAX_LEVEL = 60;

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const SLOTS = {
  afternoon: 'Afternoon (12–6pm)',
  evening: 'Evening (6–10pm)',
  late: 'Late (10pm+)',
};

export const EVENT_KINDS = {
  dungeon: { label: 'Dungeon', defaultSize: 5 },
  raid: { label: 'Raid', defaultSize: 40 },
  other: { label: 'Other', defaultSize: 10 },
};

// Where gear goes on a character
export const GEAR_SLOTS = [
  'Head', 'Neck', 'Shoulder', 'Back', 'Chest', 'Wrist', 'Hands', 'Waist',
  'Legs', 'Feet', 'Finger 1', 'Finger 2', 'Trinket 1', 'Trinket 2',
  'Main Hand', 'Off Hand', 'Ranged',
];

// Slot an item drops for (rings/trinkets aren't numbered here)
export const ITEM_SLOTS = [
  'Head', 'Neck', 'Shoulder', 'Back', 'Chest', 'Wrist', 'Hands', 'Waist',
  'Legs', 'Feet', 'Finger', 'Trinket', 'One-Hand', 'Two-Hand', 'Main Hand',
  'Off Hand', 'Held In Off-hand', 'Shield', 'Ranged', 'Relic', 'Bag', 'Other',
];

// Which item slots can go in each gear slot (used by the gear search)
export const ITEM_SLOTS_FOR_GEAR = {
  'Finger 1': ['Finger'], 'Finger 2': ['Finger'],
  'Trinket 1': ['Trinket'], 'Trinket 2': ['Trinket'],
  'Main Hand': ['One-Hand', 'Two-Hand', 'Main Hand'],
  'Off Hand': ['Off Hand', 'Held In Off-hand', 'One-Hand', 'Shield'],
  Ranged: ['Ranged', 'Relic', 'Thrown'],
};

export const QUALITY = {
  common: { label: 'Common', color: 'var(--q-common)' },
  uncommon: { label: 'Uncommon', color: 'var(--q-uncommon)' },
  rare: { label: 'Rare', color: 'var(--q-rare)' },
  epic: { label: 'Epic', color: 'var(--q-epic)' },
  legendary: { label: 'Legendary', color: 'var(--q-legendary)' },
};

export const PRIORITY = { 1: 'High', 2: 'Medium', 3: 'Low' };

// Link to the item: the saved link, or a Wowhead search as a fallback.
export function itemLink(item) {
  if (item?.link) return item.link;
  return `https://www.wowhead.com/classic/search?q=${encodeURIComponent(item?.name ?? item?.item_name ?? '')}`;
}

// Retail-only classes (for retail characters you track for logs). Kept separate from
// CLASSES so the Classic loot advice doesn't try to gear them.
export const RETAIL_ONLY_CLASSES = {
  'Death Knight': '#c41e3a',
  Monk: '#00ff98',
  'Demon Hunter': '#a330c9',
  Evoker: '#33937f',
};

export function classColor(className) {
  return CLASSES[className] ?? RETAIL_ONLY_CLASSES[className] ?? 'var(--muted)';
}

// Which game a character is on. Changes the realm box, level cap and where logs are looked up.
export const GAMES = {
  forever: { label: 'WoW: Forever', maxLevel: 60 },
  classic: { label: 'Classic', maxLevel: 60 },
  retail: { label: 'Retail', maxLevel: 90 },
};
export const gameOf = (c) => (c?.game && GAMES[c.game] ? c.game : 'forever');
export const maxLevelFor = (c) => GAMES[gameOf(c)].maxLevel;

/** Classes to offer for a game */
export const classesFor = (game) => (game === 'retail' ? [...Object.keys(CLASSES), ...Object.keys(RETAIL_ONLY_CLASSES)].sort() : Object.keys(CLASSES));

const RETAIL_RACES = ['Blood Elf', 'Draenei', 'Worgen', 'Goblin', 'Pandaren', 'Void Elf', 'Lightforged Draenei', 'Nightborne',
  'Highmountain Tauren', 'Dark Iron Dwarf', "Mag'har Orc", 'Kul Tiran', 'Zandalari Troll', 'Mechagnome', 'Vulpera', 'Dracthyr', 'Earthen'];
/** Races to offer for a game */
export const racesFor = (game) => (game === 'retail'
  ? [...RACES.filter((r) => r !== 'Skyborne'), ...RETAIL_RACES]
  : game === 'classic' ? RACES.filter((r) => r !== 'Skyborne') : RACES);

// WoW: Forever has no realms: one big server per ruleset in each region.
// (For Classic you can still type a realm name in the same box.)
export const RULESETS = ['Normal', 'PvP', 'RP', 'RP-PvP', 'Hardcore'];

