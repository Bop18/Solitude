-- Solitude update 6: automatic dungeon & raid progress
-- Paste ALL of this into Supabase → SQL Editor → New query → Run (once).
-- Needs schema.sql … schema-5 run first.

-- ============================================================
-- Boss kills
-- ============================================================
create table public.boss_kills (
  id bigint generated always as identity primary key,
  encounter_id int,                           -- the game's encounter id (null for manual entries)
  boss text not null,
  instance text,                              -- dungeon/raid name as the game calls it
  dungeon_id bigint references public.dungeons(id) on delete set null,
  group_size int,
  killed_at timestamptz not null default now(),
  member_names text[] not null default '{}',  -- everyone in the group, as the game saw them
  character_ids bigint[] not null default '{}', -- those names matched to Solitude characters
  event_id bigint references public.events(id) on delete set null,
  source text not null default 'addon' check (source in ('addon', 'manual')),
  uploaded_by uuid default auth.uid() references public.profiles(id) on delete set null
);
create index boss_kills_time_idx on public.boss_kills (killed_at desc);
create index boss_kills_dungeon_idx on public.boss_kills (dungeon_id);

alter table public.boss_kills enable row level security;
create policy "members read kills" on public.boss_kills for select to authenticated using (true);
-- The companion uploads through solitude_upload() below; people can also tick kills by hand
create policy "members mark kills" on public.boss_kills for insert to authenticated
  with check (auth.uid() = uploaded_by and source = 'manual');
create policy "uploader removes kill" on public.boss_kills for delete to authenticated using (auth.uid() = uploaded_by);

-- ============================================================
-- Raid lockouts (which bosses each character has killed this reset)
-- ============================================================
create table public.raid_lockouts (
  id bigint generated always as identity primary key,
  character_id bigint not null references public.characters(id) on delete cascade,
  instance text not null,
  dungeon_id bigint references public.dungeons(id) on delete set null,
  resets_at timestamptz not null,
  bosses jsonb not null default '[]',          -- [{ "name": "Lucifron", "killed": true }, …]
  killed int not null default 0,
  total int not null default 0,
  updated_at timestamptz not null default now(),
  unique (character_id, instance, resets_at)
);
alter table public.raid_lockouts enable row level security;
create policy "members read lockouts" on public.raid_lockouts for select to authenticated using (true);

-- ============================================================
-- Activity feed: first kills
-- ============================================================
alter table public.activity drop constraint if exists activity_kind_check;
alter table public.activity add constraint activity_kind_check check (kind in ('level', 'loot', 'event', 'character', 'kill'));
alter table public.activity add column if not exists detail text;
alter table public.activity add column if not exists dungeon_id bigint references public.dungeons(id) on delete cascade;

create function public.activity_on_kill()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- First time the group has killed this boss?
  if not exists (
    select 1 from boss_kills
    where id <> new.id and lower(boss) = lower(new.boss)
      and dungeon_id is not distinct from new.dungeon_id
  ) then
    insert into activity (kind, actor, detail, dungeon_id, event_id)
    values ('kill', new.uploaded_by, new.boss, new.dungeon_id, new.event_id);
  end if;
  return new;
end; $$;
create trigger activity_first_kill after insert on public.boss_kills
  for each row execute function public.activity_on_kill();

-- Discord: post first kills too
alter table public.app_settings add column if not exists notify_kills boolean not null default true;

create or replace function public.discord_on_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  s app_settings;
  char_name text; item_name text; who text; ev events; link text := ''; dname text;
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

  elsif new.kind = 'kill' and s.notify_kills then
    select name into dname from dungeons where id = new.dungeon_id;
    perform discord_send('⚔️ First kill: **' || new.detail || '**' || coalesce(' (' || dname || ')', '') || '!');

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

-- ============================================================
-- Helpers
-- ============================================================

-- Which Solitude dungeon is this? Prefer the boss (from the loot data), then the name.
create function public.find_dungeon(p_instance text, p_boss text)
returns bigint language sql stable security definer set search_path = public as $$
  select coalesce(
    (select i.dungeon_id from items i where p_boss is not null and lower(i.boss) = lower(p_boss) and i.dungeon_id is not null limit 1),
    (select d.id from dungeons d where lower(d.name) = lower(p_instance) limit 1),
    (select d.id from dungeons d where lower(p_instance) = lower('The Temple of Atal''Hakkar') and d.name = 'Sunken Temple' limit 1),
    (select d.id from dungeons d where lower(p_instance) in ('ahn''qiraj temple', 'ahn''qiraj') and d.name = 'Temple of Ahn''Qiraj' limit 1)
  );
$$;

-- "Bob-Pyrewood Village" → "bob"
create function public.base_name(n text)
returns text language sql immutable as $$ select lower(split_part(n, '-', 1)) $$;

-- ============================================================
-- The companion app's upload: kills, lockouts, gear & level in one go.
-- Runs as the logged-in player; only ever changes THEIR characters.
-- ============================================================
create function public.solitude_upload(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  c jsonb; k jsonb; l jsonb; g jsonb;
  ch characters;
  existing boss_kills;
  killed timestamptz;
  names text[];
  ids bigint[];
  item_row items;
  stats jsonb := jsonb_build_object('chars_synced', 0, 'chars_added', 0, 'kills_added', 0, 'kills_merged', 0, 'lockouts', 0);
  slot_name text;
  slot_map jsonb := '{"1":"Head","2":"Neck","3":"Shoulder","15":"Back","5":"Chest","9":"Wrist","10":"Hands","6":"Waist","7":"Legs","8":"Feet","11":"Finger 1","12":"Finger 2","13":"Trinket 1","14":"Trinket 2","16":"Main Hand","17":"Off Hand","18":"Ranged"}';
  item_slot_map jsonb := '{"Finger 1":"Finger","Finger 2":"Finger","Trinket 1":"Trinket","Trinket 2":"Trinket"}';
  qualities text[] := array['poor','common','uncommon','rare','epic','legendary'];
  snap_time timestamptz;
begin
  if uid is null then raise exception 'Not logged in'; end if;

  -- ---------- Characters: level + gear ----------
  for c in select * from jsonb_array_elements(coalesce(payload->'chars', '[]')) loop
    select * into ch from characters
      where owner = uid and lower(name) = lower(c->>'name')
        and (realm is null or c->>'realm' is null or lower(realm) = lower(c->>'realm'))
      order by is_main desc limit 1;

    if ch.id is null then
      -- New character: add it for them
      insert into characters (owner, name, realm, class, race, level, is_main)
      values (uid, c->>'name', c->>'realm', coalesce(initcap(lower(c->>'class')), 'Warrior'), c->>'race',
              greatest(1, least(100, coalesce((c->>'level')::int, 1))),
              not exists (select 1 from characters where owner = uid))
      returning * into ch;
      stats := jsonb_set(stats, '{chars_added}', to_jsonb((stats->>'chars_added')::int + 1));
    end if;

    snap_time := to_timestamp(coalesce((c->>'updated')::bigint, extract(epoch from now())::bigint));
    -- Skip if we already have newer data for this character
    if ch.synced_at is not null and ch.synced_at >= snap_time then
      ch := null;
      continue;
    end if;

    if c ? 'gear' then
      delete from character_gear where character_id = ch.id;
      for g in select * from jsonb_array_elements(c->'gear') loop
        slot_name := slot_map->>(g->>'slot');
        continue when slot_name is null or (g->>'id') is null;
        select * into item_row from items where game_id = (g->>'id')::int;
        if item_row.id is null then
          insert into items (game_id, name, quality, ilvl, slot, link, created_by)
          values ((g->>'id')::int, coalesce(nullif(g->>'name', ''), 'Item ' || (g->>'id')),
                  case when (g->>'q') ~ '^[1-5]$' then qualities[(g->>'q')::int + 1] else 'common' end,
                  nullif(g->>'ilvl', '')::int,
                  coalesce(item_slot_map->>slot_name, slot_name),
                  'https://www.wowhead.com/classic/item=' || (g->>'id'), uid)
          on conflict (game_id) do update set name = items.name
          returning * into item_row;
        end if;
        insert into character_gear (character_id, slot, item_name, item_id, updated_at)
        values (ch.id, slot_name, item_row.name, item_row.id, now())
        on conflict (character_id, slot) do update set item_name = excluded.item_name, item_id = excluded.item_id, updated_at = now();
        item_row := null;
      end loop;

      -- Wearing something on their Need list? Record it as received.
      insert into loot_history (item_id, character_id, recorded_by, note)
        select w.item_id, ch.id, uid, 'Seen equipped (companion)'
        from wishlist w join character_gear cg on cg.item_id = w.item_id and cg.character_id = ch.id
        where w.character_id = ch.id and not w.obtained;
    end if;

    update characters set
      level = greatest(1, least(100, coalesce((c->>'level')::int, level))),
      synced_at = snap_time, sync_source = 'companion', updated_at = now()
    where id = ch.id;
    stats := jsonb_set(stats, '{chars_synced}', to_jsonb((stats->>'chars_synced')::int + 1));
    ch := null;
  end loop;

  -- ---------- Boss kills ----------
  for k in select * from jsonb_array_elements(coalesce(payload->'kills', '[]')) loop
    continue when (k->>'boss') is null or (k->>'t') is null;
    killed := to_timestamp((k->>'t')::bigint);
    select array_agg(distinct x) into names from jsonb_array_elements_text(coalesce(k->'members', '[]')) x;
    names := coalesce(names, '{}');
    select coalesce(array_agg(distinct id), '{}') into ids from characters where base_name(name) = any (select base_name(n) from unnest(names) n);

    -- Same kill already uploaded by someone else? (same boss within 15 minutes)
    select * into existing from boss_kills
      where lower(boss) = lower(k->>'boss')
        and abs(extract(epoch from killed_at - killed)) < 900
      limit 1;

    if existing.id is not null then
      update boss_kills set
        member_names = coalesce((select array_agg(distinct x) from unnest(member_names || names) x), '{}'),
        character_ids = coalesce((select array_agg(distinct x) from unnest(character_ids || ids) x), '{}')
      where id = existing.id;
      stats := jsonb_set(stats, '{kills_merged}', to_jsonb((stats->>'kills_merged')::int + 1));
      existing := null;
    else
      insert into boss_kills (encounter_id, boss, instance, dungeon_id, group_size, killed_at, member_names, character_ids, source, uploaded_by)
      values (nullif(k->>'enc', '')::int, k->>'boss', k->>'instance', find_dungeon(k->>'instance', k->>'boss'),
              nullif(k->>'size', '')::int, killed, names, ids, 'addon', uid);
      stats := jsonb_set(stats, '{kills_added}', to_jsonb((stats->>'kills_added')::int + 1));
    end if;
  end loop;

  -- ---------- Raid lockouts ----------
  for l in select * from jsonb_array_elements(coalesce(payload->'lockouts', '[]')) loop
    select * into ch from characters
      where owner = uid and lower(name) = lower(l->>'char') order by is_main desc limit 1;
    continue when ch.id is null or (l->>'resets') is null;
    insert into raid_lockouts (character_id, instance, dungeon_id, resets_at, bosses, killed, total, updated_at)
    values (ch.id, l->>'instance',
            find_dungeon(l->>'instance', (select b->>'name' from jsonb_array_elements(coalesce(l->'bosses', '[]')) b limit 1)),
            date_trunc('hour', to_timestamp((l->>'resets')::bigint) + interval '30 minutes'),
            coalesce(l->'bosses', '[]'), coalesce((l->>'killed')::int, 0), coalesce((l->>'total')::int, 0), now())
    on conflict (character_id, instance, resets_at) do update set
      bosses = excluded.bosses, killed = excluded.killed, total = excluded.total, updated_at = now();
    stats := jsonb_set(stats, '{lockouts}', to_jsonb((stats->>'lockouts')::int + 1));
    ch := null;
  end loop;

  return stats;
end; $$;
grant execute on function public.solitude_upload(jsonb) to authenticated;

-- ============================================================
-- Each dungeon's bosses (from the loot data), for the Progress page
-- ============================================================
create view public.dungeon_bosses with (security_invoker = true) as
  select dungeon_id, boss, avg(ilvl)::real as avg_ilvl, count(*)::int as drops
  from public.items
  where boss is not null and dungeon_id is not null
  group by dungeon_id, boss;
grant select on public.dungeon_bosses to authenticated;
