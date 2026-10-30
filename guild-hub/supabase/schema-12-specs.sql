-- Solitude update 12: specs (e.g. Holy / Protection / Retribution Paladin)
-- Paste ALL of this into Supabase → SQL Editor → New query → Run (choose "Run without RLS").
-- Safe to run more than once.

alter table public.characters add column if not exists spec text;
