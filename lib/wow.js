// Game data the site uses. WoW: Forever is a "reimagined" Classic, so if it
// adds or changes classes, just edit this list.

export const CLASSES = {
  Druid: '#FF7C0A',
  Hunter: '#AAD372',
  Mage: '#3FC7EB',
  Paladin: '#F48CBA',
  Priest: '#E8E8E8',
  Rogue: '#FFF468',
  Shaman: '#0070DD',
  Warlock: '#8788EE',
  Warrior: '#C69B6D',
};

export const CLASS_NAMES = Object.keys(CLASSES);

export const RACES = [
  'Human', 'Dwarf', 'Night Elf', 'Gnome',
  'Orc', 'Undead', 'Tauren', 'Troll',
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
  'Off Hand', 'Shield', 'Ranged', 'Bag', 'Other',
];

export const QUALITY = {
  common: { label: 'Common', color: '#ffffff' },
  uncommon: { label: 'Uncommon', color: '#1eff00' },
  rare: { label: 'Rare', color: '#0070dd' },
  epic: { label: 'Epic', color: '#a335ee' },
  legendary: { label: 'Legendary', color: '#ff8000' },
};

export const PRIORITY = { 1: 'High', 2: 'Medium', 3: 'Low' };

// Link to the item: the saved link, or a Wowhead search as a fallback.
export function itemLink(item) {
  if (item?.link) return item.link;
  return `https://www.wowhead.com/classic/search?q=${encodeURIComponent(item?.name ?? item?.item_name ?? '')}`;
}

export function classColor(className) {
  return CLASSES[className] ?? '#cccccc';
}
