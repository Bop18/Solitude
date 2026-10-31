-- Solitude update 13: Warcraft Logs
-- Paste ALL of this into Supabase → SQL Editor → New query → Run (choose "Run without RLS").
-- Safe to run more than once.

create table if not exists public.logs (
  id bigint generated always as identity primary key,
  code text not null unique,             -- the report code from the link
  url text not null,
  title text,
  zone text,
  started_at timestamptz,
  ended_at timestamptz,
  data jsonb,                            -- our saved copy of the report summary
  event_id bigint references public.events(id) on delete set null,
  added_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists logs_started_idx on public.logs (started_at desc);
create index if not exists logs_event_idx on public.logs (event_id);

alter table public.logs enable row level security;
grant select, insert, update, delete on public.logs to authenticated;

drop policy if exists "members read logs" on public.logs;
create policy "members read logs" on public.logs for select to authenticated using (true);

drop policy if exists "add logs" on public.logs;
create policy "add logs" on public.logs for insert to authenticated with check (added_by = auth.uid());

-- Anyone in the group can refresh a log or link it to a run
drop policy if exists "update logs" on public.logs;
create policy "update logs" on public.logs for update to authenticated using (true) with check (true);

drop policy if exists "remove own logs" on public.logs;
create policy "remove own logs" on public.logs for delete to authenticated using (added_by = auth.uid());
