// ============================================================
// Class guides: best talents and how to level, for each class and spec.
// Classic: based on the original Classic talent trees (WoW: Forever may change some;
// check in game). Retail: talents change every patch, so we link to live builds instead.
// ============================================================

export const CLASSIC_GUIDES = {
  Warrior: {
    intro: 'Strong in groups, slow on your own early on. Levelling is about keeping rage up and downtime down.',
    level: {
      spec: 'Arms',
      why: 'Big two-hand hits, Sweeping Strikes for pulls of two, and Mortal Strike at 40.',
      talents: ['Improved Heroic Strike', 'Tactical Mastery', 'Deflection', 'Improved Rend', 'Anger Management', 'Deep Wounds', 'Two-Handed Weapon Specialization', 'Impale', 'Sweeping Strikes', 'Mortal Strike'],
      steps: [
        'Levels 1–10: Battle Stance, Charge in, Rend, then Heroic Strike with spare rage. Wear the slowest, hardest-hitting two-hander you can find.',
        'Level 10: do the Defensive Stance quest from your class trainer. Learn Sunder Armor and Taunt for dungeons.',
        'Learn First Aid early and bandage between pulls. It saves more time than anything else.',
        'Level 30: do the Berserker Stance quest, and the quest for a Whirlwind Axe (a big two-hander upgrade).',
        'Level 40: learn Plate Mail, take Mortal Strike. Use Sweeping Strikes and Cleave on two mobs.',
        'In dungeons from about 15 on, you can tank: switch to Defensive Stance with a shield and Sunder Armor.',
      ],
    },
    specs: [
      {
        spec: 'dps', name: 'Fury (raid DPS)', role: 'dps', build: 'About 17 Arms / 34 Fury',
        talents: ['Improved Heroic Strike', 'Tactical Mastery', 'Anger Management', 'Deep Wounds', 'Impale', 'Cruelty', 'Unbridled Wrath', 'Improved Battle Shout', 'Dual Wield Specialization', 'Death Wish', 'Flurry', 'Bloodthirst'],
        tip: 'Dual wield two one-handers. Bloodthirst and Whirlwind on cooldown, Heroic Strike with spare rage.',
      },
      {
        spec: 'prot', name: 'Protection (main tank)', role: 'tank', build: 'About 8 Arms / 5 Fury / 38 Protection',
        talents: ['Tactical Mastery', 'Cruelty', 'Shield Specialization', 'Anticipation', 'Toughness', 'Improved Shield Block', 'Defiance', 'Last Stand', 'Concussion Blow', 'One-Handed Weapon Specialization', 'Shield Slam'],
        tip: 'Sunder Armor and Shield Slam for threat, Revenge whenever it lights up, Shield Block against big hits.',
      },
    ],
  },

  Paladin: {
    intro: 'Very hard to kill and heals itself, so levelling has almost no downtime. Slow but steady.',
    level: {
      spec: 'Retribution',
      why: 'Seal of Command with a slow two-hander hits hard, and you can still heal in a pinch.',
      talents: ['Benediction', 'Improved Judgement', 'Improved Seal of the Crusader', 'Deflection', 'Seal of Command', 'Conviction', 'Two-Handed Weapon Specialization', 'Vengeance', 'Repentance'],
      steps: [
        'Levels 1–10: Seal of Righteousness, Judgement on pulls, Blessing of Might on yourself. Use a two-hander.',
        'Level 12: do the Redemption quest so you can resurrect people.',
        'Level 20: take Seal of Command and the slowest two-hander you can find. Keep Seal of Command up and Judge it when it helps.',
        'Heal yourself with Holy Light only when low. Lay on Hands for emergencies.',
        'Level 40: learn Plate Mail. Consecration (Holy talent) is great for groups if you pick it up later.',
        'In dungeons you are welcome as an off-healer with Blessing of Wisdom or Kings on everyone.',
      ],
    },
    specs: [
      {
        spec: 'holy', name: 'Holy (raid healer)', role: 'healer', build: 'About 31 Holy / 20 Protection',
        talents: ['Divine Intellect', 'Spiritual Focus', 'Healing Light', 'Improved Blessing of Wisdom', 'Illumination', 'Divine Favor', 'Holy Power', 'Improved Devotion Aura', 'Blessing of Kings'],
        tip: 'Flash of Light for most healing, Holy Light on tanks. Illumination refunds mana on crits.',
      },
      {
        spec: 'prot', name: 'Protection (tank)', role: 'tank', build: 'Most points in Protection to Holy Shield',
        talents: ['Redoubt', 'Toughness', 'Blessing of Kings', 'Improved Righteous Fury', 'Shield Specialization', 'Anticipation', 'Blessing of Sanctuary', 'Holy Shield'],
        tip: 'Righteous Fury on, Consecration for groups of mobs, Holy Shield up all the time. Great at tanking many weak mobs.',
      },
      {
        spec: 'ret', name: 'Retribution (melee DPS)', role: 'dps', build: 'Most points in Retribution, some in Protection for Blessing of Kings',
        talents: ['Benediction', 'Improved Judgement', 'Seal of Command', 'Conviction', 'Vengeance', 'Two-Handed Weapon Specialization', 'Sanctity Aura', 'Repentance'],
        tip: 'Mostly a support spec in raids: your Judgements and auras help the group.',
      },
    ],
  },

  Hunter: {
    intro: 'The easiest class to level: your pet tanks while you shoot.',
    level: {
      spec: 'Beast Mastery',
      why: 'A stronger, faster pet means less damage taken and faster kills.',
      talents: ['Improved Aspect of the Hawk', 'Endurance Training', 'Thick Hide', 'Unleashed Fury', 'Ferocity', 'Bestial Discipline', 'Frenzy', 'Intimidation', 'Spirit Bond', 'Bestial Wrath'],
      steps: [
        'Level 10: do the hunter quests to learn Tame Beast. Tame a cat or boar early (cats for damage, boars for tanking).',
        'Keep your pet happy by feeding it, and learn new pet abilities by taming beasts that have them (e.g. Bite, Claw).',
        'Always have the best bow, gun or crossbow you can get. Your ranged weapon matters more than anything else.',
        'Send the pet in first, wait a second, then shoot. Use Serpent Sting and Arcane Shot. Mend Pet when it gets low.',
        'Level 20: Aspect of the Cheetah for running around (turn it off in fights).',
        'Level 40: learn Mail. Bestial Wrath makes your pet hit very hard for a while.',
      ],
    },
    specs: [
      {
        spec: 'marksmanship', name: 'Marksmanship (raid DPS)', role: 'dps', build: 'About 20 Beast Mastery / 31 Marksmanship',
        talents: ['Improved Aspect of the Hawk', 'Endurance Training', 'Lethal Shots', 'Efficiency', 'Aimed Shot', 'Mortal Shots', 'Barrage', 'Ranged Weapon Specialization', 'Trueshot Aura'],
        tip: 'Auto Shot plus Multi-Shot and Aimed Shot between shots. Trueshot Aura helps the whole group.',
      },
      {
        spec: 'beast-mastery', name: 'Beast Mastery', role: 'dps', build: 'Deep Beast Mastery',
        talents: ['Unleashed Fury', 'Ferocity', 'Frenzy', 'Bestial Discipline', 'Spirit Bond', 'Bestial Wrath'],
        tip: 'Best for levelling and solo play. In raids most hunters switch to Marksmanship.',
      },
      {
        spec: 'survival', name: 'Survival', role: 'dps', build: 'Deep Survival',
        talents: ['Surefooted', 'Deterrence', 'Lightning Reflexes', 'Killer Instinct', 'Counterattack', 'Wyvern Sting'],
        tip: 'Mostly for PvP. Lightning Reflexes (more Agility) is popular in raid builds too.',
      },
    ],
  },

  Rogue: {
    intro: 'Fast and sneaky. Pick your fights, use Stealth to skip mobs, and bandage between pulls.',
    level: {
      spec: 'Combat',
      why: 'Most consistent damage and the best survival tools (Riposte, Blade Flurry, Adrenaline Rush).',
      talents: ['Improved Sinister Strike', 'Lightning Reflexes', 'Precision', 'Improved Backstab', 'Riposte', 'Dual Wield Specialization', 'Blade Flurry', 'Sword Specialization', 'Weapon Expertise', 'Aggression', 'Adrenaline Rush'],
      steps: [
        'Levels 1–10: Sinister Strike to 3–5 combo points, then Eviscerate. Learn First Aid straight away.',
        'Keep Slice and Dice up on longer fights. Use Gouge or Kick to stop casters.',
        'Level 20: do the poisons quest. Instant Poison on both weapons is a big damage boost.',
        'Use a slow sword or mace in your main hand and a fast one in your off hand.',
        'Evasion and Sprint get you out of bad pulls. Vanish if it goes really wrong.',
        'Level 40: Blade Flurry and Adrenaline Rush (31 points) make big pulls easy.',
      ],
    },
    specs: [
      {
        spec: 'combat', name: 'Combat Swords (raid DPS)', role: 'dps', build: 'About 20 Assassination / 31 Combat',
        talents: ['Malice', 'Ruthlessness', 'Murder', 'Improved Slice and Dice', 'Relentless Strikes', 'Lethality', 'Improved Sinister Strike', 'Precision', 'Dual Wield Specialization', 'Blade Flurry', 'Sword Specialization', 'Weapon Expertise', 'Aggression', 'Adrenaline Rush'],
        tip: 'Keep Slice and Dice up, Sinister Strike to build points, Eviscerate at 5. Watch your threat.',
      },
      {
        spec: 'assassination', name: 'Assassination (Seal Fate)', role: 'dps', build: 'Deep Assassination to Seal Fate, rest in Combat',
        talents: ['Malice', 'Murder', 'Relentless Strikes', 'Lethality', 'Cold Blood', 'Seal Fate', 'Vigor'],
        tip: 'Great with daggers and lots of crit gear.',
      },
      {
        spec: 'subtlety', name: 'Subtlety', role: 'dps', build: 'Deep Subtlety',
        talents: ['Opportunity', 'Camouflage', 'Initiative', 'Hemorrhage', 'Preparation', 'Premeditation'],
        tip: 'Mostly for PvP.',
      },
    ],
  },

  Priest: {
    intro: 'Squishy but mana-efficient. A wand is your best friend while levelling.',
    level: {
      spec: 'Shadow',
      why: 'Spirit Tap gives back mana after every kill, and Shadowform at 40 boosts damage and cuts damage taken.',
      talents: ['Wand Specialization (Discipline)', 'Spirit Tap', 'Improved Shadow Word: Pain', 'Shadow Focus', 'Improved Mind Blast', 'Mind Flay', 'Shadow Reach', 'Vampiric Embrace', 'Shadow Weaving', 'Shadowform'],
      steps: [
        'Get a wand as soon as you can (Enchanting crafted ones are cheap) and take Wand Specialization first.',
        'Pull with Shadow Word: Pain, Power Word: Shield yourself, then wand the mob down. Mind Blast when it helps.',
        'Take Spirit Tap: after each kill you regain mana fast, so you rarely need to drink.',
        'Mind Flay (about level 20) slows the mob and does good damage.',
        'Level 40: Shadowform. Remember you have to leave it to heal.',
        'In dungeons, you are often the healer. Keep Renew and Shield on the tank.',
      ],
    },
    specs: [
      {
        spec: 'holy', name: 'Holy / Discipline (raid healer)', role: 'healer', build: 'About 21 Discipline / 30 Holy',
        talents: ['Unbreakable Will', 'Improved Power Word: Fortitude', 'Meditation', 'Inner Focus', 'Mental Agility', 'Mental Strength', 'Divine Spirit', 'Holy Specialization', 'Spiritual Guidance', 'Spiritual Healing', 'Improved Healing', 'Spirit of Redemption'],
        tip: 'Use the right rank of Heal or Greater Heal for the job. Prayer of Healing for the whole group.',
      },
      {
        spec: 'shadow', name: 'Shadow (DPS)', role: 'dps', build: 'Deep Shadow',
        talents: ['Spirit Tap', 'Improved Shadow Word: Pain', 'Shadow Focus', 'Improved Mind Blast', 'Mind Flay', 'Vampiric Embrace', 'Shadow Weaving', 'Darkness', 'Shadowform'],
        tip: 'In raids, Shadow Weaving boosts every warlock\'s Shadow Bolts. One shadow priest is a big help.',
      },
    ],
  },

  Mage: {
    intro: 'Great damage and the best AoE grinder, but fragile. Conjure your own food and water.',
    level: {
      spec: 'Frost',
      why: 'Slows and roots keep mobs off you, and Improved Blizzard lets you AoE grind big packs.',
      talents: ['Improved Frostbolt', 'Elemental Precision', 'Ice Shards', 'Frostbite', 'Permafrost', 'Piercing Ice', 'Improved Blizzard', 'Shatter', 'Ice Block', 'Cold Snap', 'Ice Barrier'],
      steps: [
        'Frostbolt is your main spell. Pull with Frostbolt, Frost Nova if it gets close, step back and finish.',
        'Conjure food and water before every session; you will never need to buy any.',
        'Polymorph a second mob when you pull two.',
        'From about level 22, AoE grinding with Frost Nova and rank 1 Blizzard (with Improved Blizzard) is very fast in the right spots.',
        'Ice Block and Cold Snap save you from bad pulls.',
        'Train every two levels: new spell ranks matter a lot for mages.',
      ],
    },
    specs: [
      {
        spec: 'fire', name: 'Fire (raid DPS)', role: 'dps', build: 'Deep Fire, rest in Arcane',
        talents: ['Arcane Subtlety', 'Arcane Focus', 'Arcane Meditation', 'Arcane Concentration', 'Improved Fireball', 'Ignite', 'Incineration', 'Improved Scorch', 'Master of Elements', 'Critical Mass', 'Fire Power', 'Combustion'],
        tip: 'Fireball spam with Scorch stacks. Not great in Molten Core (fire-immune bosses); Frost is often used early.',
      },
      {
        spec: 'frost', name: 'Frost', role: 'dps', build: 'Deep Frost, rest in Arcane',
        talents: ['Arcane Concentration', 'Improved Frostbolt', 'Elemental Precision', 'Ice Shards', 'Piercing Ice', 'Winter\'s Chill', 'Ice Barrier'],
        tip: 'Safe and steady. Good for early raids and for levelling.',
      },
      {
        spec: 'arcane', name: 'Arcane', role: 'dps', build: 'Deep Arcane with some Frost or Fire',
        talents: ['Arcane Concentration', 'Arcane Mind', 'Presence of Mind', 'Arcane Instability', 'Arcane Power'],
        tip: 'Big burst with Arcane Power and Presence of Mind.',
      },
    ],
  },

  Warlock: {
    intro: 'DoT things and let your demon tank. Life Tap turns health into mana, so you rarely stop.',
    level: {
      spec: 'Affliction',
      why: 'DoTs do the work while your Voidwalker tanks, and Siphon Life keeps you topped up.',
      talents: ['Improved Corruption', 'Suppression', 'Improved Life Tap', 'Improved Drain Life', 'Fel Concentration', 'Amplify Curse', 'Nightfall', 'Siphon Life', 'Shadow Mastery'],
      steps: [
        'Level 10: do the Voidwalker quest. Let it tank while you DoT.',
        'Corruption and Curse of Agony on everything, wand while they tick. Drain Life when low.',
        'Life Tap for mana, then heal with Drain Life. You almost never need to sit down.',
        'Level 20: Succubus quest; level 30: Felhunter quest.',
        'Keep a few Soul Shards: Drain Soul a mob as it dies to get one.',
        'Level 40: you learn your mount (Summon Felsteed) from your trainer, so save gold for it.',
      ],
    },
    specs: [
      {
        spec: 'destruction', name: 'Destruction (raid DPS)', role: 'dps', build: 'About 30 Affliction (Shadow Mastery) / 21 Destruction (Ruin)',
        talents: ['Suppression', 'Improved Corruption', 'Shadow Mastery', 'Improved Shadow Bolt', 'Bane', 'Devastation', 'Ruin'],
        tip: 'Shadow Bolt spam with Curse of Shadow or Elements up. Watch your threat.',
      },
      {
        spec: 'affliction', name: 'Affliction', role: 'dps', build: 'Deep Affliction',
        talents: ['Improved Corruption', 'Nightfall', 'Siphon Life', 'Amplify Curse', 'Shadow Mastery', 'Dark Pact'],
        tip: 'Best for levelling and solo play.',
      },
      {
        spec: 'demonology', name: 'Demonology', role: 'dps', build: 'Deep Demonology',
        talents: ['Demonic Embrace', 'Fel Domination', 'Fel Intellect', 'Master Summoner', 'Demonic Sacrifice', 'Master Demonologist', 'Soul Link'],
        tip: 'Demonic Sacrifice (sacrifice your Succubus) gives a big Shadow damage boost in raids.',
      },
    ],
  },

  Druid: {
    intro: 'Can do every job. Cat for damage, Bear for tanking, and heal yourself between fights.',
    level: {
      spec: 'Feral',
      why: 'Cat Form kills fast, Bear Form is tough, and you can heal yourself after fights.',
      talents: ['Ferocity', 'Feral Instinct', 'Thick Hide', 'Feral Swiftness', 'Sharpened Claws', 'Predatory Strikes', 'Blood Frenzy', 'Feral Charge', 'Savage Fury', 'Heart of the Wild', 'Leader of the Pack'],
      steps: [
        'Levels 1–10: Wrath and Moonfire from range, finish in melee. Heal with Healing Touch or Rejuvenation.',
        'Level 10: do the Bear Form quest. Bear is your main form until Cat.',
        'Level 16: do the Aquatic Form quest (swimming), level 20: Cat Form. Cat with Claw, Rip and Ferocious Bite kills fastest.',
        'Level 30: Travel Form for running between quests.',
        'Shift out to heal yourself after fights and drink while in caster form.',
        'In dungeons you can tank in Bear Form or heal. Very flexible.',
      ],
    },
    specs: [
      {
        spec: 'resto', name: 'Restoration (raid healer)', role: 'healer', build: 'Deep Restoration',
        talents: ['Furor', 'Improved Healing Touch', 'Nature\'s Focus', 'Reflection', 'Tranquil Spirit', 'Improved Rejuvenation', 'Nature\'s Swiftness', 'Gift of Nature', 'Improved Regrowth', 'Swiftmend'],
        tip: 'Rejuvenation on tanks, Healing Touch for big heals, Nature\'s Swiftness for emergencies. Innervate a healer who needs mana.',
      },
      {
        spec: 'bear', name: 'Feral (Bear tank)', role: 'tank', build: 'Deep Feral',
        talents: ['Ferocity', 'Feral Instinct', 'Thick Hide', 'Sharpened Claws', 'Predatory Strikes', 'Primal Fury', 'Feral Charge', 'Heart of the Wild', 'Leader of the Pack'],
        tip: 'Great off-tank. Maul and Swipe for threat, Demoralizing Roar on every pull.',
      },
      {
        spec: 'cat', name: 'Feral (Cat DPS)', role: 'dps', build: 'Deep Feral',
        talents: ['Ferocity', 'Sharpened Claws', 'Blood Frenzy', 'Predatory Strikes', 'Savage Fury', 'Heart of the Wild', 'Leader of the Pack'],
        tip: 'Leader of the Pack gives your whole group more crit.',
      },
      {
        spec: 'balance', name: 'Balance (Moonkin)', role: 'dps', build: 'Deep Balance',
        talents: ['Improved Wrath', 'Improved Moonfire', 'Vengeance', 'Moonglow', 'Nature\'s Grace', 'Moonfury', 'Moonkin Form'],
        tip: 'Moonkin Aura gives your group spell crit. Mana is tight, so pace yourself.',
      },
    ],
  },

  Shaman: {
    intro: 'Hits hard with a two-hander, heals well and brings totems that help the whole group.',
    level: {
      spec: 'Enhancement',
      why: 'Two-hand weapons with Windfury and Flurry hit very hard, and Stormstrike comes at 40.',
      talents: ['Ancestral Knowledge', 'Shield Specialization', 'Thundering Strikes', 'Improved Ghost Wolf', 'Two-Handed Axes and Maces', 'Flurry', 'Elemental Weapons', 'Parry', 'Weapon Mastery', 'Stormstrike'],
      steps: [
        'Do the totem quests: Earth at level 4, Fire at 10, Water at 20, Air at 30. Each unlocks a set of totems.',
        'Use the slowest two-hander you can with Rockbiter Weapon (Windfury Weapon from level 30).',
        'Pull with Lightning Bolt, then melee. Earth Shock to interrupt casters.',
        'Level 20: Ghost Wolf for running. Heal yourself with Healing Wave between fights.',
        'Level 40: learn Mail and take Stormstrike.',
        'In dungeons you are often the healer or an off-healer; totems help everyone.',
      ],
    },
    specs: [
      {
        spec: 'resto', name: 'Restoration (raid healer)', role: 'healer', build: 'Deep Restoration',
        talents: ['Tidal Focus', 'Improved Healing Wave', 'Totemic Focus', 'Tidal Mastery', 'Healing Way', 'Nature\'s Swiftness', 'Ancestral Healing', 'Purification', 'Mana Tide Totem'],
        tip: 'Chain Heal is your best spell for groups. Keep Mana Spring and Mana Tide down for your party.',
      },
      {
        spec: 'ele', name: 'Elemental (caster DPS)', role: 'dps', build: 'Deep Elemental',
        talents: ['Convection', 'Concussion', 'Call of Flame', 'Elemental Focus', 'Call of Thunder', 'Elemental Fury', 'Lightning Mastery', 'Elemental Mastery'],
        tip: 'Big burst with Elemental Mastery, but mana runs out quickly.',
      },
      {
        spec: 'enh', name: 'Enhancement (melee DPS)', role: 'dps', build: 'Deep Enhancement',
        talents: ['Thundering Strikes', 'Two-Handed Axes and Maces', 'Flurry', 'Elemental Weapons', 'Weapon Mastery', 'Stormstrike'],
        tip: 'Windfury Totem is a big boost for warriors and rogues in your group.',
      },
    ],
  },
};

// ---------- Retail: specs + links to live builds ----------
export const RETAIL_SPECS = {
  'Death Knight': [['Blood', 'tank'], ['Frost', 'dps'], ['Unholy', 'dps']],
  'Demon Hunter': [['Havoc', 'dps'], ['Vengeance', 'tank'], ['Devourer', 'dps']],
  Druid: [['Balance', 'dps'], ['Feral', 'dps'], ['Guardian', 'tank'], ['Restoration', 'healer']],
  Evoker: [['Devastation', 'dps'], ['Preservation', 'healer'], ['Augmentation', 'dps']],
  Hunter: [['Beast Mastery', 'dps'], ['Marksmanship', 'dps'], ['Survival', 'dps']],
  Mage: [['Arcane', 'dps'], ['Fire', 'dps'], ['Frost', 'dps']],
  Monk: [['Brewmaster', 'tank'], ['Mistweaver', 'healer'], ['Windwalker', 'dps']],
  Paladin: [['Holy', 'healer'], ['Protection', 'tank'], ['Retribution', 'dps']],
  Priest: [['Discipline', 'healer'], ['Holy', 'healer'], ['Shadow', 'dps']],
  Rogue: [['Assassination', 'dps'], ['Outlaw', 'dps'], ['Subtlety', 'dps']],
  Shaman: [['Elemental', 'dps'], ['Enhancement', 'dps'], ['Restoration', 'healer']],
  Warlock: [['Affliction', 'dps'], ['Demonology', 'dps'], ['Destruction', 'dps']],
  Warrior: [['Arms', 'dps'], ['Fury', 'dps'], ['Protection', 'tank']],
};

const slug = (s) => s.toLowerCase().replace(/\s+/g, '-');

/** Links to up-to-date retail talent builds for a spec. */
export function retailLinks(cls, spec, role) {
  const c = slug(cls);
  const s = slug(spec);
  const r = role === 'tank' ? 'tank' : role === 'healer' ? 'healing' : 'dps';
  return [
    { label: 'Talent builds (Icy Veins)', url: `https://www.icy-veins.com/wow/${s}-${c}-pve-${r}-spec-builds-talents` },
    { label: 'What top players use (Murlok.io)', url: `https://murlok.io/${c}/${s}/mm+` },
    { label: 'Talent calculator (Wowhead)', url: `https://www.wowhead.com/talent-calc/${c}/${s}` },
  ];
}

/** Wowhead's Classic talent calculator for a class. */
export const classicCalcUrl = (cls) => `https://www.wowhead.com/classic/talent-calc/${slug(cls)}`;
