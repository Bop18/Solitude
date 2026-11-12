-- Solitude update 20: WoW: Forever's new dungeons and raids (from Blizzard's launch info)
-- Paste ALL of this into Supabase → SQL Editor → New query → Run (choose "Run without RLS").
-- Safe to run more than once. Loot gets added as people press Need / the addon sees items.

insert into public.dungeons (name, kind, min_level, max_level, size, game, notes) values
  ('Hall of Thanes',            'dungeon', 13, 18,  5, 'classic', 'WoW: Forever'),
  ('Ruins of Lordaeron',        'dungeon', 15, 20,  5, 'classic', 'WoW: Forever'),
  ('Excavation Site: Wetlands', 'dungeon', 24, 29,  5, 'classic', 'WoW: Forever'),
  ('City of Dalaran',           'dungeon', 28, 33,  5, 'classic', 'WoW: Forever'),
  ('The Drowned City',          'dungeon', 35, 40,  5, 'classic', 'WoW: Forever'),
  ('Krol''dok Stronghold',      'dungeon', 40, 45,  5, 'classic', 'WoW: Forever'),
  ('Alcaz Prison',              'dungeon', 48, 53,  5, 'classic', 'WoW: Forever'),
  ('Blackmaw Hold',             'dungeon', 55, 60,  5, 'classic', 'WoW: Forever'),
  ('Shaper''s Terrace',         'dungeon', 58, 60,  5, 'classic', 'WoW: Forever'),
  ('Barrow Deeps',              'raid',    60, 60, 10, 'classic', 'WoW: Forever raid · opens 9 Dec'),
  ('Hyjal Summit',              'raid',    60, 60, 20, 'classic', 'WoW: Forever raid · opens 9 Dec'),
  ('Onyxia''s Lair',            'raid',    60, 60, 40, 'classic', 'Opens 9 Dec in WoW: Forever')
on conflict (name) do update set
  kind = excluded.kind, min_level = excluded.min_level, max_level = excluded.max_level,
  size = excluded.size, notes = excluded.notes;
