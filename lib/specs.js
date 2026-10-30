// ============================================================
// Specs ("subclasses"): the same class can want very different gear.
// A Holy Paladin wants Int and healing; a Ret Paladin wants Strength.
//
// rel = how useful each stat is to the spec (1 = core, 0.5 = nice, 0 = wasted)
// type = which kind of crit/hit the spec uses (physical or spell)
// weapon = whether weapon damage matters ('melee', 'ranged', 'wand' or null)
// Classes without a list here (Hunter, Rogue, Mage, Warlock) gear the same in every spec.
// ============================================================

const PHYS_MELEE = { type: 'physical', weapon: 'melee' };
const CASTER = { type: 'caster', weapon: 'wand' };

export const SPECS = {
  Warrior: [
    { id: 'dps', name: 'Arms / Fury', short: 'DPS', role: 'dps', ...PHYS_MELEE,
      rel: { str: 1, agi: 0.7, sta: 0.4, ap: 1, crit: 1, hit: 1 } },
    { id: 'prot', name: 'Protection', short: 'Prot', role: 'tank', ...PHYS_MELEE,
      rel: { sta: 1, def: 1, dodge: 1, parry: 1, block: 1, blockValue: 1, agi: 0.7, str: 0.6, hit: 0.6, hp5: 0.5, ap: 0.3, crit: 0.3 } },
  ],
  Paladin: [
    { id: 'holy', name: 'Holy', short: 'Holy', role: 'healer', ...CASTER, weapon: null,
      rel: { int: 1, sp: 1, mp5: 1, crit: 0.7, sta: 0.4, spi: 0.3 } },
    { id: 'prot', name: 'Protection', short: 'Prot', role: 'tank', type: 'physical', weapon: 'melee',
      rel: { sta: 1, def: 1, dodge: 1, parry: 1, block: 1, blockValue: 1, sp: 0.6, str: 0.5, agi: 0.5, int: 0.5, hit: 0.5, mp5: 0.4 } },
    { id: 'ret', name: 'Retribution', short: 'Ret', role: 'dps', ...PHYS_MELEE,
      rel: { str: 1, ap: 1, crit: 1, hit: 1, agi: 0.6, sta: 0.4, int: 0.3, sp: 0.2, mp5: 0.2 } },
  ],
  Druid: [
    { id: 'balance', name: 'Balance', short: 'Balance', role: 'dps', ...CASTER, weapon: null,
      rel: { int: 1, sp: 1, crit: 1, hit: 1, mp5: 0.6, spi: 0.5, sta: 0.4 } },
    { id: 'cat', name: 'Feral (Cat)', short: 'Cat', role: 'dps', type: 'physical', weapon: null,
      rel: { agi: 1, str: 1, ap: 1, feralAp: 1, crit: 1, hit: 1, sta: 0.4 } },
    { id: 'bear', name: 'Feral (Bear)', short: 'Bear', role: 'tank', type: 'physical', weapon: null,
      rel: { sta: 1, agi: 1, def: 1, dodge: 1, str: 0.7, feralAp: 0.6, hit: 0.6, ap: 0.5, crit: 0.4 } },
    { id: 'resto', name: 'Restoration', short: 'Resto', role: 'healer', ...CASTER, weapon: null,
      rel: { int: 1, spi: 1, sp: 1, mp5: 1, sta: 0.4, crit: 0.3 } },
  ],
  Shaman: [
    { id: 'ele', name: 'Elemental', short: 'Ele', role: 'dps', ...CASTER, weapon: null,
      rel: { int: 1, sp: 1, crit: 1, hit: 1, mp5: 0.7, sta: 0.4, spi: 0.3 } },
    { id: 'enh', name: 'Enhancement', short: 'Enh', role: 'dps', ...PHYS_MELEE,
      rel: { str: 1, ap: 1, crit: 1, hit: 1, agi: 0.7, sta: 0.4, int: 0.3, mp5: 0.2 } },
    { id: 'resto', name: 'Restoration', short: 'Resto', role: 'healer', ...CASTER, weapon: null,
      rel: { int: 1, sp: 1, mp5: 1, crit: 0.6, spi: 0.4, sta: 0.4 } },
  ],
  Priest: [
    { id: 'holy', name: 'Holy / Discipline', short: 'Healer', role: 'healer', ...CASTER,
      rel: { int: 1, spi: 1, sp: 1, mp5: 1, sta: 0.4, crit: 0.4 } },
    { id: 'shadow', name: 'Shadow', short: 'Shadow', role: 'dps', ...CASTER,
      rel: { sp: 1, hit: 1, spi: 0.8, int: 0.7, sta: 0.7, mp5: 0.5, crit: 0.3 } },
  ],
};

// One-spec classes still get a profile, so every character can be scored the same way.
const SINGLE = {
  Hunter: { id: 'all', name: 'All specs', short: '', role: 'dps', type: 'physical', weapon: 'ranged',
    rel: { agi: 1, rap: 1, crit: 1, hit: 1, int: 0.5, ap: 0.5, mp5: 0.4, sta: 0.4, spi: 0.2, str: 0.2 } },
  Rogue: { id: 'all', name: 'All specs', short: '', role: 'dps', ...PHYS_MELEE,
    rel: { agi: 1, ap: 1, crit: 1, hit: 1, str: 0.7, sta: 0.4 } },
  Mage: { id: 'all', name: 'All specs', short: '', role: 'dps', ...CASTER,
    rel: { int: 1, sp: 1, crit: 1, hit: 1, spi: 0.5, mp5: 0.5, sta: 0.4 } },
  Warlock: { id: 'all', name: 'All specs', short: '', role: 'dps', ...CASTER,
    rel: { sp: 1, hit: 1, int: 0.8, crit: 0.8, sta: 0.8, spi: 0.5, mp5: 0.4 } },
};

/** The specs you can pick for a class ([] if it gears the same in every spec). */
export const specsOf = (cls) => SPECS[cls] ?? [];

/** A spec's profile; for one-spec classes, their single profile. */
export function specProfile(cls, specId) {
  return SPECS[cls]?.find((s) => s.id === specId) ?? SINGLE[cls] ?? null;
}

/** The character's spec: what they picked, or a safe guess from their role (null if unclear). */
export function specOf(character) {
  const list = SPECS[character?.class];
  if (!list) return SINGLE[character?.class] ? 'all' : null;
  if (character.spec && list.some((s) => s.id === character.spec)) return character.spec;
  const byRole = list.filter((s) => s.role === character.role);
  return byRole.length === 1 ? byRole[0].id : null;
}

export const specName = (cls, specId) => specProfile(cls, specId)?.name ?? '';
