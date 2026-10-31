-- Solitude update 16: which game each character is on (WoW: Forever, Classic or Retail)
-- Paste ALL of this into Supabase → SQL Editor → New query → Run (choose "Run without RLS").
-- Safe to run more than once.

alter table public.characters add column if not exists game text not null default 'forever';
alter table public.characters drop constraint if exists characters_game_check;
alter table public.characters add constraint characters_game_check check (game in ('forever', 'classic', 'retail'));
