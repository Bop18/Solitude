-- Solitude update 21: "Log in with Battle.net"
-- Paste ALL of this into Supabase → SQL Editor → New query → Run (choose "Run without RLS").
-- Safe to run more than once.

-- Each person's Battle.net connection (only they can see their own row)
create table if not exists public.bnet_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  battletag text,
  access_token text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.bnet_links enable row level security;
drop policy if exists "own bnet link" on public.bnet_links;
create policy "own bnet link" on public.bnet_links
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.bnet_links to authenticated;

-- What Battle.net calls the character, so Sync can find it exactly
alter table public.characters add column if not exists bnet_id bigint;
alter table public.characters add column if not exists bnet_name text;
alter table public.characters add column if not exists bnet_realm text;
alter table public.characters add column if not exists server_name text;
