-- Solitude update 7: hourly availability
-- Paste ALL of this into Supabase → SQL Editor → New query → Run.
-- Safe to run again if it was interrupted.
-- (This file switches Row Level Security on itself. If Supabase warns about RLS,
--  "Run without RLS" is fine here, because the security rules are set up below.)

-- day: 0 = Monday … 6 = Sunday
-- hour: 12–23 for that day, 24 = midnight and 25 = 1am (still counted as that evening)
create table if not exists public.availability_hours (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  day int not null check (day between 0 and 6),
  hour int not null check (hour between 0 and 25),
  primary key (user_id, day, hour)
);

alter table public.availability_hours enable row level security;

drop policy if exists "members read availability hours" on public.availability_hours;
drop policy if exists "add own hours" on public.availability_hours;
drop policy if exists "remove own hours" on public.availability_hours;
create policy "members read availability hours" on public.availability_hours for select to authenticated using (true);
create policy "add own hours" on public.availability_hours for insert to authenticated with check (auth.uid() = user_id);
create policy "remove own hours" on public.availability_hours for delete to authenticated using (auth.uid() = user_id);

-- Carry over everyone's old afternoon / evening / late ticks
insert into public.availability_hours (user_id, day, hour)
select
  user_id,
  day,
  generate_series(
    case slot when 'afternoon' then 12 when 'evening' then 18 else 22 end,
    case slot when 'afternoon' then 17 when 'evening' then 21 else 25 end
  )
from public.availability
on conflict do nothing;
