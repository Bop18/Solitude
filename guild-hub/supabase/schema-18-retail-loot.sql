-- Solitude update 18: retail dungeons & raids on the Loot page
-- Paste ALL of this into Supabase → SQL Editor → New query → Run (choose "Run without RLS").
-- Safe to run more than once.

-- Which game a dungeon/raid belongs to (everything so far is Classic / WoW: Forever)
alter table public.dungeons add column if not exists game text not null default 'classic';
alter table public.dungeons drop constraint if exists dungeons_game_check;
alter table public.dungeons add constraint dungeons_game_check check (game in ('classic', 'retail'));
-- Blizzard's Adventure Journal id (retail), so re-loading updates instead of duplicating
alter table public.dungeons add column if not exists journal_id int;

-- Boss order inside a dungeon (1 = first boss), so loot can be shown in kill order
alter table public.items add column if not exists boss_order int;

create index if not exists dungeons_game_idx on public.dungeons (game);
