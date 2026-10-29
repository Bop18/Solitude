-- Solitude update 8: boss tactics and tank routes
-- Paste ALL of this into Supabase → SQL Editor → New query → Run (once).

-- ============================================================
-- Boss tactics (one per boss per dungeon; anyone can improve them)
-- ============================================================
create table public.boss_notes (
  id bigint generated always as identity primary key,
  dungeon_id bigint not null references public.dungeons(id) on delete cascade,
  boss text not null,
  summary text,       -- what the fight is about
  tank text,          -- tips for tanks
  healer text,        -- tips for healers
  dps text,           -- tips for DPS
  position int,       -- order, for bosses added by hand
  updated_by uuid default auth.uid() references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
create unique index boss_notes_unique on public.boss_notes (dungeon_id, lower(boss));

alter table public.boss_notes enable row level security;
create policy "members read boss notes" on public.boss_notes for select to authenticated using (true);
create policy "members write boss notes" on public.boss_notes for insert to authenticated with check (true);
create policy "members edit boss notes" on public.boss_notes for update to authenticated using (true);
create policy "members remove boss notes" on public.boss_notes for delete to authenticated using (true);

-- ============================================================
-- Tank routes: a map with numbered pulls
-- ============================================================
create table public.routes (
  id bigint generated always as identity primary key,
  dungeon_id bigint not null references public.dungeons(id) on delete cascade,
  name text not null default 'Route',
  description text,
  map_url text,                 -- uploaded map image (or any image link)
  is_default boolean not null default false,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index routes_dungeon_idx on public.routes (dungeon_id);

create table public.route_steps (
  id bigint generated always as identity primary key,
  route_id bigint not null references public.routes(id) on delete cascade,
  position int not null default 0,
  kind text not null default 'pull' check (kind in ('pull', 'boss', 'skip', 'note')),
  title text,
  note text,
  x real check (x between 0 and 1),   -- where on the map (0–1 across), null if no map
  y real check (y between 0 and 1)
);
create index route_steps_route_idx on public.route_steps (route_id, position);

alter table public.routes enable row level security;
alter table public.route_steps enable row level security;
-- Small group: everyone can edit routes; only the creator can delete a whole route
create policy "members read routes" on public.routes for select to authenticated using (true);
create policy "members add routes" on public.routes for insert to authenticated with check (auth.uid() = created_by);
create policy "members edit routes" on public.routes for update to authenticated using (true);
create policy "creator deletes route" on public.routes for delete to authenticated using (auth.uid() = created_by);
create policy "members read steps" on public.route_steps for select to authenticated using (true);
create policy "members add steps" on public.route_steps for insert to authenticated with check (true);
create policy "members edit steps" on public.route_steps for update to authenticated using (true);
create policy "members remove steps" on public.route_steps for delete to authenticated using (true);

-- Only one default route per dungeon
create function public.single_default_route()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_default then
    update routes set is_default = false where dungeon_id = new.dungeon_id and id <> new.id and is_default;
  end if;
  return new;
end; $$;
create trigger routes_single_default after insert or update of is_default on public.routes
  for each row when (new.is_default) execute function public.single_default_route();

-- ============================================================
-- Map images (Supabase Storage bucket "maps", publicly viewable)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('maps', 'maps', true)
on conflict (id) do nothing;

create policy "members upload maps" on storage.objects for insert to authenticated
  with check (bucket_id = 'maps');
create policy "anyone views maps" on storage.objects for select
  using (bucket_id = 'maps');
create policy "uploader removes map" on storage.objects for delete to authenticated
  using (bucket_id = 'maps' and owner = auth.uid());

-- Remember who last edited a note or route
create function public.touch_edited()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  if auth.uid() is not null and tg_table_name = 'boss_notes' then new.updated_by := auth.uid(); end if;
  return new;
end; $$;
create trigger boss_notes_touch before update on public.boss_notes for each row execute function public.touch_edited();
create trigger routes_touch before update on public.routes for each row execute function public.touch_edited();
