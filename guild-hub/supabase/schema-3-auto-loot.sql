-- Solitude update 3: automatic loot data, upgrades, activity feed,
-- loot history and Discord notifications.
-- Run ONCE in Supabase → SQL Editor → New query → Run
-- (after schema.sql and schema-2-loot.sql).

-- ============================================================
-- 1. Items get real game data (filled by the "Load Classic loot" button)
-- ============================================================

alter table public.items
  add column game_id int unique,          -- the game's item id (null for items you typed in)
  add column kind text,                   -- Armor / Weapon
  add column ilvl int,
  add column req_level int,
  add column stats jsonb not null default '{}',
  add column dps real,
  add column speed real,
  add column class_restrict text[] not null default '{}',
  add column drop_chance real;

create index items_dungeon_idx on public.items (dungeon_id);
create index items_name_idx on public.items (lower(name));
create index items_slot_idx on public.items (slot);

-- Turn items you typed in by hand into the real game item with the same name,
-- moving any wishlist / gear / loot history across. Called after loading game data.
create function public.merge_duplicate_items()
returns int
language plpgsql security definer set search_path = public
as $$
declare
  r record;
  merged int := 0;
begin
  for r in
    select u.id as old_id, g.id as new_id, g.name as new_name
    from items u
    join lateral (
      select g.* from items g
      where g.game_id is not null and lower(g.name) = lower(trim(u.name))
      order by (g.dungeon_id is not distinct from u.dungeon_id) desc, g.id
      limit 1
    ) g on true
    where u.game_id is null
  loop
    insert into wishlist (character_id, item_id, priority, obtained, created_at)
      select character_id, r.new_id, priority, obtained, created_at from wishlist where item_id = r.old_id
      on conflict (character_id, item_id) do nothing;
    delete from wishlist where item_id = r.old_id;
    update character_gear set item_id = r.new_id, item_name = r.new_name where item_id = r.old_id;
    update loot_history set item_id = r.new_id where item_id = r.old_id;
    update activity set item_id = r.new_id where item_id = r.old_id;
    delete from items where id = r.old_id;
    merged := merged + 1;
  end loop;
  return merged;
end;
$$;
grant execute on function public.merge_duplicate_items() to authenticated;

-- ============================================================
-- 2. Loot history: who got what, and when
-- ============================================================

create table public.loot_history (
  id bigint generated always as identity primary key,
  item_id bigint not null references public.items(id) on delete cascade,
  character_id bigint not null references public.characters(id) on delete cascade,
  event_id bigint references public.events(id) on delete set null,
  recorded_by uuid default auth.uid() references public.profiles(id) on delete set null,
  note text,
  received_at timestamptz not null default now()
);
create index loot_history_char_idx on public.loot_history (character_id);

alter table public.loot_history enable row level security;
create policy "members read loot history" on public.loot_history for select to authenticated using (true);
-- Anyone can record loot for anyone (e.g. the raid leader handing things out)
create policy "members record loot" on public.loot_history for insert to authenticated with check (auth.uid() = recorded_by);
create policy "recorder or owner removes loot" on public.loot_history for delete to authenticated
  using (auth.uid() = recorded_by or public.owns_character(character_id));

-- ============================================================
-- 3. Activity feed
-- ============================================================

create table public.activity (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('level', 'loot', 'event', 'character')),
  actor uuid references public.profiles(id) on delete cascade,
  character_id bigint references public.characters(id) on delete cascade,
  item_id bigint references public.items(id) on delete cascade,
  event_id bigint references public.events(id) on delete cascade,
  level int,
  created_at timestamptz not null default now()
);
create index activity_created_idx on public.activity (created_at desc);

alter table public.activity enable row level security;
create policy "members read activity" on public.activity for select to authenticated using (true);
-- No insert policy: only the triggers below write here.

-- New character
create function public.activity_on_character()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into activity (kind, actor, character_id, level) values ('character', new.owner, new.id, new.level);
  return new;
end; $$;
create trigger activity_new_character after insert on public.characters
  for each row execute function public.activity_on_character();

-- Level milestones: every 10 levels, and max level
create function public.activity_on_level()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.level > old.level and (new.level / 10 > old.level / 10 or (new.level >= 60 and old.level < 60)) then
    insert into activity (kind, actor, character_id, level) values ('level', new.owner, new.id, new.level);
  end if;
  return new;
end; $$;
create trigger activity_level_up after update of level on public.characters
  for each row execute function public.activity_on_level();

-- Loot received: tick it off the wishlist and post to the feed
create function public.activity_on_loot()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner_id uuid;
begin
  update wishlist set obtained = true where character_id = new.character_id and item_id = new.item_id;
  select owner into owner_id from characters where id = new.character_id;
  insert into activity (kind, actor, character_id, item_id, event_id) values ('loot', owner_id, new.character_id, new.item_id, new.event_id);
  return new;
end; $$;
create trigger activity_loot after insert on public.loot_history
  for each row execute function public.activity_on_loot();

-- New event planned
create function public.activity_on_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into activity (kind, actor, event_id) values ('event', new.created_by, new.id);
  return new;
end; $$;
create trigger activity_new_event after insert on public.events
  for each row execute function public.activity_on_event();

-- ============================================================
-- 4. Discord notifications
-- ============================================================
-- Uses two Supabase extensions: pg_net (send web requests) and pg_cron (run on a timer).

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- Private settings. Row Level Security is on with NO policies, so the website
-- can't read it (your webhook URL stays secret); only these functions can.
create table public.app_settings (
  id int primary key default 1 check (id = 1),
  discord_webhook_url text,
  site_url text,
  notify_events boolean not null default true,
  notify_reminders boolean not null default true,
  notify_loot boolean not null default true,
  notify_levels boolean not null default true,
  reminder_minutes int not null default 60
);
insert into public.app_settings (id) values (1);
alter table public.app_settings enable row level security;

alter table public.events add column reminder_sent boolean not null default false;

-- Send one message to Discord (does nothing until a webhook URL is set)
create function public.discord_send(message text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare url text;
begin
  select discord_webhook_url into url from app_settings where id = 1;
  if url is null or url = '' then return; end if;
  perform net.http_post(
    url := url,
    body := jsonb_build_object('content', message, 'username', 'Solitude', 'allowed_mentions', jsonb_build_object('parse', '[]'::jsonb)),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
exception when others then
  -- Never let a Discord problem break the website
  raise warning 'Discord notification failed: %', sqlerrm;
end; $$;

-- Post feed items to Discord
create function public.discord_on_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  s app_settings;
  char_name text; item_name text; who text; ev events; link text := '';
begin
  select * into s from app_settings where id = 1;
  if s.discord_webhook_url is null then return new; end if;

  select name into char_name from characters where id = new.character_id;
  select name into item_name from items where id = new.item_id;
  select display_name into who from profiles where id = new.actor;

  if new.kind = 'loot' and s.notify_loot then
    perform discord_send('🎁 **' || coalesce(char_name, '?') || '** got **[' || coalesce(item_name, '?') || ']**');

  elsif new.kind = 'level' and s.notify_levels then
    perform discord_send(case when new.level >= 60 then '👑 **' else '⬆️ **' end || coalesce(char_name, '?') || '** hit level ' || new.level || '!');

  elsif new.kind = 'event' and s.notify_events then
    select * into ev from events where id = new.event_id;
    if s.site_url is not null then link := chr(10) || rtrim(s.site_url, '/') || '/events/' || ev.id; end if;
    perform discord_send(
      '📅 **' || coalesce(who, 'Someone') || '** planned **' || ev.title || '** — <t:' || extract(epoch from ev.starts_at)::bigint || ':F> (<t:'
      || extract(epoch from ev.starts_at)::bigint || ':R>)' || chr(10) || 'Sign up on the site!' || link
    );
  end if;
  return new;
exception when others then
  raise warning 'Discord activity post failed: %', sqlerrm;
  return new;
end; $$;
create trigger discord_activity after insert on public.activity
  for each row execute function public.discord_on_activity();

-- Reminders: runs every 5 minutes, posts once per event shortly before it starts
create function public.send_event_reminders()
returns void language plpgsql security definer set search_path = public as $$
declare
  s app_settings;
  ev record;
  going text;
  going_count int;
  link text;
begin
  select * into s from app_settings where id = 1;
  if s.discord_webhook_url is null or not s.notify_reminders then return; end if;

  for ev in
    select * from events
    where not reminder_sent
      and starts_at > now()
      and starts_at <= now() + make_interval(mins => s.reminder_minutes)
  loop
    select string_agg(coalesce(c.name, p.display_name), ', ' order by su.role), count(*)
      into going, going_count
      from event_signups su
      join profiles p on p.id = su.user_id
      left join characters c on c.id = su.character_id
      where su.event_id = ev.id and su.status = 'going';

    link := case when s.site_url is not null then chr(10) || rtrim(s.site_url, '/') || '/events/' || ev.id else '' end;
    perform discord_send(
      '⏰ **' || ev.title || '** starts <t:' || extract(epoch from ev.starts_at)::bigint || ':R>!' || chr(10)
      || 'Going (' || coalesce(going_count, 0) || '/' || ev.max_size || '): ' || coalesce(going, 'nobody yet') || link
    );
    update events set reminder_sent = true where id = ev.id;
  end loop;
end; $$;

select cron.schedule('solitude-event-reminders', '*/5 * * * *', $$select public.send_event_reminders()$$);
