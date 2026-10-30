-- Solitude update 11: speed. Indexes for the lookups the site does most.
-- Paste ALL of this into Supabase → SQL Editor → New query → Run (choose "Run without RLS").
-- Safe to run more than once.

-- Loot near your level, per dungeon
create index if not exists items_dungeon_level_idx on public.items (dungeon_id, req_level);
-- Matching boss kills to dungeons, and the boss list on each dungeon
create index if not exists items_boss_idx on public.items (lower(boss));
-- "Who needs this item?" on dungeon and loot pages
create index if not exists wishlist_item_idx on public.wishlist (item_id);
create index if not exists loot_history_item_idx on public.loot_history (item_id);
-- Your characters, your sign-ups, upcoming events
create index if not exists characters_owner_idx on public.characters (owner);
create index if not exists event_signups_user_idx on public.event_signups (user_id);
create index if not exists events_starts_idx on public.events (starts_at);
create index if not exists boss_notes_dungeon_idx on public.boss_notes (dungeon_id);

-- Fast item search while you type (finds "rapier" inside "Defias Rapier")
create extension if not exists pg_trgm with schema extensions;
create index if not exists items_name_trgm_idx on public.items using gin (name extensions.gin_trgm_ops);

-- Refresh the planner's statistics so it uses the new indexes straight away
analyze public.items;
analyze public.characters;
analyze public.wishlist;
