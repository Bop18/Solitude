-- Solitude update 22: keep everyone's characters up to date from Battle.net automatically
-- Paste into Supabase → SQL Editor → Run (choose "Run without RLS"). Safe to run more than once.
alter table public.characters add column if not exists sync_checked_at timestamptz;
create index if not exists characters_sync_checked_idx on public.characters (sync_checked_at nulls first);
