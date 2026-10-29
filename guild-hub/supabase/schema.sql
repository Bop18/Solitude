-- Guild Hub database schema
-- Paste this whole file into Supabase → SQL Editor → New query → Run.

-- ============ TABLES ============

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table public.characters (
  id bigint generated always as identity primary key,
  owner uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null,
  realm text,
  class text not null,
  race text,
  role text check (role in ('tank', 'healer', 'dps')),
  level int not null default 1 check (level between 1 and 100),
  is_main boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Weekly availability: day 0 = Monday ... 6 = Sunday
create table public.availability (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  day int not null check (day between 0 and 6),
  slot text not null check (slot in ('afternoon', 'evening', 'late')),
  primary key (user_id, day, slot)
);

create table public.events (
  id bigint generated always as identity primary key,
  title text not null,
  kind text not null default 'dungeon' check (kind in ('dungeon', 'raid', 'other')),
  starts_at timestamptz not null,
  max_size int not null default 5,
  notes text,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.event_signups (
  event_id bigint not null references public.events(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  character_id bigint references public.characters(id) on delete set null,
  role text check (role in ('tank', 'healer', 'dps')),
  status text not null default 'going' check (status in ('going', 'maybe', 'not_going')),
  primary key (event_id, user_id)
);

-- ============ AUTO-CREATE A PROFILE ON SIGN-UP ============

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============ SECURITY (Row Level Security) ============
-- Logged-in members can SEE everything; they can only CHANGE their own stuff.

alter table public.profiles enable row level security;
alter table public.characters enable row level security;
alter table public.availability enable row level security;
alter table public.events enable row level security;
alter table public.event_signups enable row level security;

create policy "members read profiles" on public.profiles for select to authenticated using (true);
create policy "edit own profile" on public.profiles for update to authenticated using (auth.uid() = id);

create policy "members read characters" on public.characters for select to authenticated using (true);
create policy "add own characters" on public.characters for insert to authenticated with check (auth.uid() = owner);
create policy "edit own characters" on public.characters for update to authenticated using (auth.uid() = owner);
create policy "delete own characters" on public.characters for delete to authenticated using (auth.uid() = owner);

create policy "members read availability" on public.availability for select to authenticated using (true);
create policy "add own availability" on public.availability for insert to authenticated with check (auth.uid() = user_id);
create policy "delete own availability" on public.availability for delete to authenticated using (auth.uid() = user_id);

create policy "members read events" on public.events for select to authenticated using (true);
create policy "members create events" on public.events for insert to authenticated with check (auth.uid() = created_by);
create policy "creator edits event" on public.events for update to authenticated using (auth.uid() = created_by);
create policy "creator deletes event" on public.events for delete to authenticated using (auth.uid() = created_by);

create policy "members read signups" on public.event_signups for select to authenticated using (true);
create policy "sign self up" on public.event_signups for insert to authenticated with check (auth.uid() = user_id);
create policy "edit own signup" on public.event_signups for update to authenticated using (auth.uid() = user_id);
create policy "remove own signup" on public.event_signups for delete to authenticated using (auth.uid() = user_id);
