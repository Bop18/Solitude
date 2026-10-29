-- Guild Hub update 2: dungeons, items, gear and wishlists
-- Run this ONCE in Supabase → SQL Editor → New query → Run
-- (after the original schema.sql, which you've already run).

-- ============ TABLES ============

create table public.dungeons (
  id bigint generated always as identity primary key,
  name text not null unique,
  kind text not null default 'dungeon' check (kind in ('dungeon', 'raid')),
  min_level int,
  max_level int,
  size int not null default 5,
  notes text
);

create table public.items (
  id bigint generated always as identity primary key,
  dungeon_id bigint references public.dungeons(id) on delete cascade,
  name text not null,
  boss text,
  slot text,
  item_type text,                       -- e.g. Cloth, Plate, Sword, Bow
  quality text not null default 'rare' check (quality in ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  classes text[] not null default '{}', -- which classes it's good for
  link text,                            -- optional Wowhead (or other) link
  notes text,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- What each character is currently wearing (one row per slot)
create table public.character_gear (
  character_id bigint not null references public.characters(id) on delete cascade,
  slot text not null,
  item_name text not null,
  item_id bigint references public.items(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (character_id, slot)
);

-- Items a character wants
create table public.wishlist (
  id bigint generated always as identity primary key,
  character_id bigint not null references public.characters(id) on delete cascade,
  item_id bigint not null references public.items(id) on delete cascade,
  priority int not null default 2 check (priority between 1 and 3), -- 1 = high
  obtained boolean not null default false,
  created_at timestamptz not null default now(),
  unique (character_id, item_id)
);

-- Events can now be linked to a dungeon (so the event shows who needs what)
alter table public.events add column dungeon_id bigint references public.dungeons(id) on delete set null;

-- ============ SECURITY ============

alter table public.dungeons enable row level security;
alter table public.items enable row level security;
alter table public.character_gear enable row level security;
alter table public.wishlist enable row level security;

-- Dungeons & items are a shared guide: any member can add and improve them,
-- only the person who added an item can delete it.
create policy "members read dungeons" on public.dungeons for select to authenticated using (true);
create policy "members add dungeons" on public.dungeons for insert to authenticated with check (true);
create policy "members edit dungeons" on public.dungeons for update to authenticated using (true);

create policy "members read items" on public.items for select to authenticated using (true);
create policy "members add items" on public.items for insert to authenticated with check (auth.uid() = created_by);
create policy "members edit items" on public.items for update to authenticated using (true);
create policy "creator deletes item" on public.items for delete to authenticated using (auth.uid() = created_by);

-- Gear & wishlists: everyone can see, only the character's owner can change.
create function public.owns_character(cid bigint)
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from characters where id = cid and owner = auth.uid()) $$;

create policy "members read gear" on public.character_gear for select to authenticated using (true);
create policy "owner adds gear" on public.character_gear for insert to authenticated with check (public.owns_character(character_id));
create policy "owner edits gear" on public.character_gear for update to authenticated using (public.owns_character(character_id));
create policy "owner removes gear" on public.character_gear for delete to authenticated using (public.owns_character(character_id));

create policy "members read wishlist" on public.wishlist for select to authenticated using (true);
create policy "owner adds wish" on public.wishlist for insert to authenticated with check (public.owns_character(character_id));
create policy "owner edits wish" on public.wishlist for update to authenticated using (public.owns_character(character_id));
create policy "owner removes wish" on public.wishlist for delete to authenticated using (public.owns_character(character_id));

-- ============ STARTER DUNGEON LIST ============
-- The original Classic dungeons and raids with rough level ranges.
-- WoW: Forever is "reimagined", so edit/add on the Dungeons page as things change.

insert into public.dungeons (name, kind, min_level, max_level, size) values
  ('Ragefire Chasm',            'dungeon', 13, 18, 5),
  ('Wailing Caverns',           'dungeon', 17, 24, 5),
  ('The Deadmines',             'dungeon', 17, 26, 5),
  ('Shadowfang Keep',           'dungeon', 22, 30, 5),
  ('Blackfathom Deeps',         'dungeon', 24, 32, 5),
  ('The Stockade',              'dungeon', 24, 32, 5),
  ('Gnomeregan',                'dungeon', 29, 38, 5),
  ('Razorfen Kraul',            'dungeon', 29, 38, 5),
  ('Scarlet Monastery',         'dungeon', 30, 45, 5),
  ('Razorfen Downs',            'dungeon', 37, 46, 5),
  ('Uldaman',                   'dungeon', 41, 51, 5),
  ('Zul''Farrak',               'dungeon', 42, 48, 5),
  ('Maraudon',                  'dungeon', 46, 55, 5),
  ('Sunken Temple',             'dungeon', 50, 56, 5),
  ('Blackrock Depths',          'dungeon', 52, 60, 5),
  ('Lower Blackrock Spire',     'dungeon', 55, 60, 5),
  ('Dire Maul',                 'dungeon', 56, 60, 5),
  ('Scholomance',               'dungeon', 58, 60, 5),
  ('Stratholme',                'dungeon', 58, 60, 5),
  ('Upper Blackrock Spire',     'raid',    58, 60, 10),
  ('Zul''Gurub',                'raid',    60, 60, 20),
  ('Ruins of Ahn''Qiraj',       'raid',    60, 60, 20),
  ('Onyxia''s Lair',            'raid',    60, 60, 40),
  ('Molten Core',               'raid',    60, 60, 40),
  ('Blackwing Lair',            'raid',    60, 60, 40),
  ('Temple of Ahn''Qiraj',      'raid',    60, 60, 40),
  ('Naxxramas',                 'raid',    60, 60, 40);
