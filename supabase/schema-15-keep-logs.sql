-- Solitude update 15: "Keep" logs (starred logs are read in full and kept for good)
-- Paste ALL of this into Supabase → SQL Editor → New query → Run (choose "Run without RLS").
-- Safe to run more than once.

alter table public.logs add column if not exists kept boolean not null default false;
create index if not exists logs_kept_idx on public.logs (kept) where kept;
