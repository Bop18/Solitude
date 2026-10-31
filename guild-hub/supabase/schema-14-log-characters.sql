-- Solitude update 14: remember which of your characters each log was found for
-- Paste ALL of this into Supabase → SQL Editor → New query → Run (choose "Run without RLS").
-- Safe to run more than once.

alter table public.logs add column if not exists found_for bigint[] not null default '{}';
create index if not exists logs_found_for_idx on public.logs using gin (found_for);
