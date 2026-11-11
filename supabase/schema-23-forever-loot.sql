-- Solitude update 23: loot for WoW: Forever's new dungeons (boss by boss, in kill order)
-- Paste ALL of this into Supabase -> SQL Editor -> Run (choose "Run without RLS"). Safe to run more than once.
-- Run schema-20-forever-dungeons.sql first. Shaper's Terrace has no known loot yet.
-- Items with a game ID get their icon, quality and stats from Battle.net when you press
-- "Reload game item data" on a dungeon page.

-- Hall of Thanes
insert into public.items (game_id, name, boss, boss_order, slot, kind, item_type, req_level, link, quality, dungeon_id)
select v.game_id::int, v.name, v.boss, v.boss_order, v.slot, v.kind, v.item_type, v.req_level::int, v.link::text, 'rare', d.id
from (values
  (270227, 'Ephemeral Choker', 'Faldrim Anvilmar', 1, 'Neck', 'Armor', 'Miscellaneous', 13, null),
  (271096, 'Aetherwisp Bracers', 'Faldrim Anvilmar', 1, 'Wrist', 'Armor', 'Cloth', 13, null),
  (271097, 'Spiritwraith Drape', 'Faldrim Anvilmar', 1, 'Back', 'Armor', 'Cloth', 13, null),
  (270228, 'Golemheart Stave', 'Plunder', 2, 'Two-Hand', 'Weapon', 'Staff', 13, null),
  (270229, 'Treads of the Protector Golem', 'Plunder', 2, 'Feet', 'Armor', 'Mail', 13, null),
  (271098, 'Golemguard Chest', 'Plunder', 2, 'Chest', 'Armor', 'Mail', 13, null),
  (270230, 'Kindlegem Girdle', 'Magmatus', 3, 'Waist', 'Armor', 'Mail', 13, null),
  (270231, 'Flamefist Grips', 'Magmatus', 3, 'Hands', 'Armor', 'Leather', 13, null),
  (271095, 'Fang of Magmatus', 'Magmatus', 3, 'Main Hand', 'Weapon', 'Dagger', 13, null),
  (270256, 'Durgen''s Crescent Axe', 'Durgen Dirgehammer', 4, 'Main Hand', 'Weapon', 'Axe', 13, null),
  (270260, 'Direhammer Leggings', 'Durgen Dirgehammer', 4, 'Legs', 'Armor', 'Leather', 13, null),
  (270261, 'Robes of the Disgraced Thane', 'Durgen Dirgehammer', 4, 'Chest', 'Armor', 'Cloth', 13, null)
) as v(game_id, name, boss, boss_order, slot, kind, item_type, req_level, link)
join public.dungeons d on d.name = 'Hall of Thanes'
where not exists (select 1 from public.items i where i.dungeon_id = d.id and lower(i.name) = lower(v.name))
  and (v.game_id is null or not exists (select 1 from public.items i where i.game_id = v.game_id::int));

-- Ruins of Lordaeron
insert into public.items (game_id, name, boss, boss_order, slot, kind, item_type, req_level, link, quality, dungeon_id)
select v.game_id::int, v.name, v.boss, v.boss_order, v.slot, v.kind, v.item_type, v.req_level::int, v.link::text, 'rare', d.id
from (values
  (271201, 'Atrophic Girdle', 'Witherfang', 1, 'Waist', 'Armor', 'Mail', 15, null),
  (271202, 'Witherbite Bracers', 'Witherfang', 1, 'Wrist', 'Armor', 'Leather', 15, null),
  (271203, 'Segmented Spider Leg', 'Witherfang', 1, 'Two-Hand', 'Weapon', 'Staff', 15, null),
  (271204, 'Meathook Slicer', 'The Baron', 2, 'One-Hand', 'Weapon', 'Dagger', 15, null),
  (271205, 'Abomination Bones', 'The Baron', 2, 'Chest', 'Armor', 'Mail', 15, null),
  (271206, 'Leftover Abomination Skin', 'The Baron', 2, 'Chest', 'Armor', 'Cloth', 15, null),
  (271209, 'Bonerust Leggings', 'Bjork', 3, 'Legs', 'Armor', 'Mail', 16, null),
  (271210, 'Tuskwrap Belt', 'Bjork', 3, 'Waist', 'Armor', 'Cloth', 16, null),
  (271217, 'Corpse Chopper', 'Bjork', 3, 'Two-Hand', 'Weapon', 'Axe', 16, null),
  (271207, 'Rotmender''s Leggings', 'The Abandoned', 4, 'Legs', 'Armor', 'Cloth', 17, null),
  (271208, 'Grip of Fear', 'The Abandoned', 4, 'Hands', 'Armor', 'Mail', 17, null),
  (271216, 'Scepter of the Abandoned', 'The Abandoned', 4, 'Main Hand', 'Weapon', 'Mace', 17, null),
  (286979, 'Rotmender''s Gloves', 'Stone Watcher', 5, 'Hands', 'Armor', 'Cloth', 17, null),
  (271211, 'Vilewalkers', 'Viktor the Vile', 6, 'Feet', 'Armor', 'Mail', 17, null),
  (271212, 'Bloodied Chestwraps', 'Viktor the Vile', 6, 'Chest', 'Armor', 'Leather', 17, null),
  (271218, 'Vileblood Scimitar', 'Viktor the Vile', 6, 'One-Hand', 'Weapon', 'Sword', 17, null),
  (271213, 'Mirror of Rath''mael', 'Rath''mael', 7, 'Off Hand', 'Armor', 'Shield', 19, null),
  (271214, 'Rotmender''s Treads', 'Rath''mael', 7, 'Feet', 'Armor', 'Cloth', 19, null),
  (271215, 'Coldspire Staff', 'Rath''mael', 7, 'Two-Hand', 'Weapon', 'Staff', 19, null)
) as v(game_id, name, boss, boss_order, slot, kind, item_type, req_level, link)
join public.dungeons d on d.name = 'Ruins of Lordaeron'
where not exists (select 1 from public.items i where i.dungeon_id = d.id and lower(i.name) = lower(v.name))
  and (v.game_id is null or not exists (select 1 from public.items i where i.game_id = v.game_id::int));

-- Excavation Site: Wetlands
insert into public.items (game_id, name, boss, boss_order, slot, kind, item_type, req_level, link, quality, dungeon_id)
select v.game_id::int, v.name, v.boss, v.boss_order, v.slot, v.kind, v.item_type, v.req_level::int, v.link::text, 'rare', d.id
from (values
  (273022, 'Supple Bellyskin Leggings', 'Saltspine', 1, 'Legs', 'Armor', 'Leather', 26, null),
  (273023, 'Saltscale Girdle', 'Saltspine', 1, 'Waist', 'Armor', 'Mail', 26, null),
  (273024, 'Glinteye Slippers', 'Saltspine', 1, 'Feet', 'Armor', 'Cloth', 26, null),
  (273025, 'Raptorclaw Greaves', 'Shadetooth', 2, 'Feet', 'Armor', 'Mail', 26, null),
  (273026, 'Garb of Florid Feathers', 'Shadetooth', 2, 'Chest', 'Armor', 'Leather', 26, null),
  (273027, 'Raptor''s Gaze', 'Shadetooth', 2, 'Held In Off-hand', 'Armor', 'Miscellaneous', 26, null),
  (273028, 'Reliquary Mantle', 'Relic Guardian', 3, 'Shoulder', 'Armor', 'Mail', 28, null),
  (273029, 'Golemsight Long Gun', 'Relic Guardian', 3, 'Ranged', 'Weapon', 'Gun', 28, null),
  (273030, 'Ring of Power Regulation', 'Relic Guardian', 3, 'Finger', 'Armor', 'Miscellaneous', 28, null)
) as v(game_id, name, boss, boss_order, slot, kind, item_type, req_level, link)
join public.dungeons d on d.name = 'Excavation Site: Wetlands'
where not exists (select 1 from public.items i where i.dungeon_id = d.id and lower(i.name) = lower(v.name))
  and (v.game_id is null or not exists (select 1 from public.items i where i.game_id = v.game_id::int));

-- City of Dalaran
insert into public.items (game_id, name, boss, boss_order, slot, kind, item_type, req_level, link, quality, dungeon_id)
select v.game_id::int, v.name, v.boss, v.boss_order, v.slot, v.kind, v.item_type, v.req_level::int, v.link::text, 'rare', d.id
from (values
  (null, 'Bonebinder''s Signet', 'Atrexis the Grave Knight', 1, 'Finger', 'Armor', 'Miscellaneous', null, null),
  (null, 'Gravespike Repeater', 'Atrexis the Grave Knight', 1, 'Ranged', 'Weapon', 'Crossbow', null, null),
  (null, 'Graveweave Bindings', 'Atrexis the Grave Knight', 1, 'Wrist', 'Armor', 'Cloth', null, null),
  (null, 'Runemender''s Seal', 'Arcane Anomaly', 2, 'Finger', 'Armor', 'Miscellaneous', null, null),
  (null, 'Ephemeral Grips', 'Arcane Anomaly', 2, 'Hands', 'Armor', 'Cloth', null, null),
  (null, 'Mana-Warped Chain Shirt', 'Arcane Anomaly', 2, 'Chest', 'Armor', 'Mail', null, null),
  (null, 'Wand of Mana Concentration', 'Arcanic Enigma', 3, 'Ranged', 'Weapon', 'Wand', null, null),
  (null, 'Violet Sorcerer''s Robes', 'Arcanic Enigma', 3, 'Chest', 'Armor', 'Cloth', null, null),
  (null, 'Drape of Shifting Energy', 'Arcanic Enigma', 3, 'Back', 'Armor', 'Cloth', null, null),
  (null, 'Guardian''s Dualblade', 'Unstable Sentinel', 4, 'Two-Hand', 'Weapon', 'Axe', null, null),
  (null, 'Unstable Crystalline Shoulderpads', 'Unstable Sentinel', 4, 'Shoulder', 'Armor', 'Leather', null, null),
  (null, 'Refractory Scaleguards', 'Unstable Sentinel', 4, 'Legs', 'Armor', 'Mail', null, null),
  (null, 'Spine of the Devourer', 'Mana Devourer', 5, 'Two-Hand', 'Weapon', 'Staff', null, null),
  (null, 'Slitherwrap Girdle', 'Mana Devourer', 5, 'Waist', 'Armor', 'Leather', null, null),
  (null, 'Manascale Treads', 'Mana Devourer', 5, 'Feet', 'Armor', 'Mail', null, null),
  (null, 'Felbough Arm', 'Fel Ancient', 6, 'Two-Hand', 'Weapon', 'Polearm', null, null),
  (null, 'Garb of Fallen Felbark', 'Fel Ancient', 6, 'Chest', 'Armor', 'Leather', null, null),
  (null, 'Blightleaf Rope', 'Fel Ancient', 6, 'Waist', 'Armor', 'Cloth', null, null),
  (null, 'Tendonscraper Dagger', 'Lyn the Ignored', 7, 'Main Hand', 'Weapon', 'Dagger', null, null),
  (null, 'Cartilage Shapers', 'Lyn the Ignored', 7, 'Hands', 'Armor', 'Leather', null, null),
  (null, 'Bonepile Gaze', 'Lyn the Ignored', 7, 'Off Hand', 'Armor', 'Shield', null, null),
  (null, 'Archmagister''s Faceted Pendant', 'Shade of the Archmage', 8, 'Neck', 'Armor', 'Miscellaneous', null, null),
  (null, 'Violet Sorcerer''s Mantle', 'Shade of the Archmage', 8, 'Shoulder', 'Armor', 'Cloth', null, null),
  (null, 'Ponderous Orb', 'Shade of the Archmage', 8, 'Held In Off-hand', 'Armor', 'Miscellaneous', null, null)
) as v(game_id, name, boss, boss_order, slot, kind, item_type, req_level, link)
join public.dungeons d on d.name = 'City of Dalaran'
where not exists (select 1 from public.items i where i.dungeon_id = d.id and lower(i.name) = lower(v.name))
  and (v.game_id is null or not exists (select 1 from public.items i where i.game_id = v.game_id::int));

-- The Drowned City
insert into public.items (game_id, name, boss, boss_order, slot, kind, item_type, req_level, link, quality, dungeon_id)
select v.game_id::int, v.name, v.boss, v.boss_order, v.slot, v.kind, v.item_type, v.req_level::int, v.link::text, 'rare', d.id
from (values
  (null, 'Bloodslash Axe', 'Zul''Alai', 1, 'One-Hand', 'Weapon', 'Axe', null, null),
  (null, 'Oathbound Bracers', 'Zul''Alai', 1, 'Wrist', 'Armor', 'Leather', null, null),
  (null, 'Berserker Shackles', 'Zul''Alai', 1, 'Wrist', 'Armor', 'Mail', null, null),
  (null, 'Gill''s Gills', 'Gill', 2, 'Trinket', 'Armor', 'Miscellaneous', null, null),
  (null, 'Tidebound Dagger', 'Gill', 2, 'Main Hand', 'Weapon', 'Dagger', null, null),
  (null, 'Dreadfrost Saber', 'Captain Dreadrise', 3, 'Main Hand', 'Weapon', 'Sword', null, null),
  (null, 'Frosty Blunderbuss', 'Captain Dreadrise', 3, 'Ranged', 'Weapon', 'Gun', null, null),
  (null, 'Briny Sash', 'Captain Dreadrise', 3, 'Waist', 'Armor', 'Cloth', null, null),
  (null, 'Robe of the Drowned', 'Primeval Elemental', 4, 'Chest', 'Armor', 'Cloth', null, null),
  (null, 'Waterlogged Burial Shroud', 'Primeval Elemental', 4, 'Back', 'Armor', 'Cloth', null, null),
  (null, 'Heart of the Primeval', 'Primeval Elemental', 4, 'Trinket', 'Armor', 'Miscellaneous', null, null),
  (null, 'Harpoon of Command', 'Var''Taka', 5, 'Two-Hand', 'Weapon', 'Polearm', null, null),
  (null, 'Brinebelly Leggings', 'Var''Taka', 5, 'Legs', 'Armor', 'Leather', null, null),
  (null, 'Priestess Cloak', 'Var''Taka', 5, 'Back', 'Armor', 'Cloth', null, null),
  (null, 'Bloodspine Staff', 'Deathless Marrow', 6, 'Two-Hand', 'Weapon', 'Staff', null, null),
  (null, 'Viscera Spaulders', 'Deathless Marrow', 6, 'Shoulder', 'Armor', 'Mail', null, null),
  (null, 'Knucklebone Ring', 'Deathless Marrow', 6, 'Finger', 'Armor', 'Miscellaneous', null, null),
  (null, 'Maw of Min''loth', 'Min''loth the Serpent', 7, 'Off Hand', 'Armor', 'Shield', null, null),
  (null, 'Serpentbane Crown', 'Min''loth the Serpent', 7, 'Head', 'Armor', 'Mail', null, null),
  (null, 'Ritual-Binder''s Gloves', 'Min''loth the Serpent', 7, 'Hands', 'Armor', 'Leather', null, null),
  (null, 'Linken''s Boots of Iron', 'Min''loth the Serpent', 7, 'Feet', 'Armor', 'Mail', null, null)
) as v(game_id, name, boss, boss_order, slot, kind, item_type, req_level, link)
join public.dungeons d on d.name = 'The Drowned City'
where not exists (select 1 from public.items i where i.dungeon_id = d.id and lower(i.name) = lower(v.name))
  and (v.game_id is null or not exists (select 1 from public.items i where i.game_id = v.game_id::int));

-- Krol'dok Stronghold
insert into public.items (game_id, name, boss, boss_order, slot, kind, item_type, req_level, link, quality, dungeon_id)
select v.game_id::int, v.name, v.boss, v.boss_order, v.slot, v.kind, v.item_type, v.req_level::int, v.link::text, 'rare', d.id
from (values
  (null, 'Slavecrusher Scepter', 'Slavecrusher Grox', 1, 'One-Hand', 'Weapon', 'Mace', null, null),
  (null, 'Resistance Breaker Spaulder', 'Slavecrusher Grox', 1, 'Shoulder', 'Armor', 'Mail', null, null),
  (null, 'Chain of Binding', 'Slavecrusher Grox', 1, 'Waist', 'Armor', 'Mail', null, null),
  (null, 'Shadowlight Athame', 'Twilight Commander Zarmok', 2, 'Main Hand', 'Weapon', 'Dagger', null, null),
  (null, 'Shadecaster''s Leggings', 'Twilight Commander Zarmok', 2, 'Legs', 'Armor', 'Cloth', null, null),
  (null, 'Zarmok''s Plated Signet', 'Twilight Commander Zarmok', 2, 'Finger', 'Armor', 'Miscellaneous', null, null),
  (null, 'Bloodied Gutslicer', 'War Handler Ashka', 3, 'Two-Hand', 'Weapon', 'Sword', null, null),
  (null, 'War Handler''s Gaze', 'War Handler Ashka', 3, 'Head', 'Armor', 'Leather', null, null),
  (null, 'Worgbinder''s Treads', 'War Handler Ashka', 3, 'Feet', 'Armor', 'Plate', null, null),
  (null, 'Band of Bossman', 'Bossman Toof', 4, 'Finger', 'Armor', 'Miscellaneous', null, null),
  (null, 'Big-Belly Belt', 'Bossman Toof', 4, 'Waist', 'Armor', 'Cloth', null, null),
  (null, 'Toofbreaker', 'Bossman Toof', 4, 'One-Hand', 'Weapon', 'Mace', null, null),
  (null, 'Chain of the Corruptor', 'Nar''gurk', 5, 'Neck', 'Armor', 'Miscellaneous', null, null),
  (null, 'Krol''dok Warplate Chest', 'Nar''gurk', 5, 'Chest', 'Armor', 'Plate', null, null),
  (null, 'Krol''dok Warplate Helmet', 'Nar''gurk', 5, 'Head', 'Armor', 'Plate', null, null),
  (null, 'Mugg''s Jabber', 'Overlord Mugg', 6, 'One-Hand', 'Weapon', 'Fist Weapon', null, null),
  (null, 'Mugg''s Crosser', 'Overlord Mugg', 6, 'One-Hand', 'Weapon', 'Fist Weapon', null, null),
  (null, 'Emblem of Slamming', 'Overlord Mugg', 6, 'Trinket', 'Armor', 'Miscellaneous', null, null)
) as v(game_id, name, boss, boss_order, slot, kind, item_type, req_level, link)
join public.dungeons d on d.name = 'Krol''dok Stronghold'
where not exists (select 1 from public.items i where i.dungeon_id = d.id and lower(i.name) = lower(v.name))
  and (v.game_id is null or not exists (select 1 from public.items i where i.game_id = v.game_id::int));

-- Alcaz Prison
insert into public.items (game_id, name, boss, boss_order, slot, kind, item_type, req_level, link, quality, dungeon_id)
select v.game_id::int, v.name, v.boss, v.boss_order, v.slot, v.kind, v.item_type, v.req_level::int, v.link::text, 'rare', d.id
from (values
  (null, 'Cloak of the Tidemistress', 'Tidemistress Ca''zass', 1, 'Back', 'Armor', 'Cloth', null, null),
  (null, 'Wrex''s Pinky Ring', 'Overseer Wrex', 2, 'Finger', 'Armor', 'Miscellaneous', null, null),
  (null, 'Sentimental Locket', 'Katerina the Cleaner', 3, 'Neck', 'Armor', 'Miscellaneous', null, null),
  (null, 'Defias Enforcer''s Shoulderpads', 'The Questioner', 4, 'Shoulder', 'Armor', 'Leather', null, null),
  (null, 'Girdle of Extracted Answers', 'The Questioner', 4, 'Waist', 'Armor', 'Plate', null, null)
) as v(game_id, name, boss, boss_order, slot, kind, item_type, req_level, link)
join public.dungeons d on d.name = 'Alcaz Prison'
where not exists (select 1 from public.items i where i.dungeon_id = d.id and lower(i.name) = lower(v.name))
  and (v.game_id is null or not exists (select 1 from public.items i where i.game_id = v.game_id::int));

-- Blackmaw Hold
insert into public.items (game_id, name, boss, boss_order, slot, kind, item_type, req_level, link, quality, dungeon_id)
select v.game_id::int, v.name, v.boss, v.boss_order, v.slot, v.kind, v.item_type, v.req_level::int, v.link::text, 'rare', d.id
from (values
  (null, 'Cloak of the Fleshborer', 'Withermaw', 1, 'Back', 'Armor', 'Cloth', null, null),
  (null, 'Tuskblade Halberd', 'Bonesnout the Unbroken', 2, 'Two-Hand', 'Weapon', 'Polearm', null, null),
  (null, 'Claymore of Two Moons', 'Moontouched Wanderer', 3, 'Two-Hand', 'Weapon', 'Sword', null, null),
  (null, 'Robes of Dark Summons', 'Impaan the Imprisoner', 4, 'Chest', 'Armor', 'Cloth', null, null),
  (null, 'Impish Chain Hood', 'Impaan the Imprisoner', 4, 'Head', 'Armor', 'Mail', null, null),
  (null, 'Flamebreak Talisman', 'Unbound Spirit', 5, 'Trinket', 'Armor', 'Miscellaneous', null, null),
  (null, 'Burnished Pridescales', 'Unbound Spirit', 5, 'Chest', 'Armor', 'Plate', null, null),
  (null, 'Behemoth Bones', 'Blackmaw Behemoth', 6, 'Trinket', 'Armor', 'Miscellaneous', null, null),
  (null, 'Trousers of the Ebon Giant', 'Blackmaw Behemoth', 6, 'Legs', 'Armor', 'Cloth', null, null),
  (null, 'Scalding Flamehoof', 'Varrox Bleakhoof', 7, 'Trinket', 'Armor', 'Miscellaneous', null, null),
  (null, 'Bleak Eye Shoulderplates', 'Varrox Bleakhoof', 7, 'Shoulder', 'Armor', 'Plate', null, null),
  (null, 'Bloody Claws of Attack', 'Elder Shaman Bloodmane', 8, 'One-Hand', 'Weapon', 'Fist Weapon', null, null),
  (null, 'Veilpiercer Girdle', 'Elder Shaman Bloodmane', 8, 'Waist', 'Armor', 'Leather', null, null)
) as v(game_id, name, boss, boss_order, slot, kind, item_type, req_level, link)
join public.dungeons d on d.name = 'Blackmaw Hold'
where not exists (select 1 from public.items i where i.dungeon_id = d.id and lower(i.name) = lower(v.name))
  and (v.game_id is null or not exists (select 1 from public.items i where i.game_id = v.game_id::int));
