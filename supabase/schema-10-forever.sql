-- Solitude update 10: WoW: Forever (rulesets instead of realms)
-- Paste ALL of this into Supabase → SQL Editor → New query → Run (choose "Run without RLS").

-- The companion upload now matches characters by name even if the realm/ruleset text differs,
-- and fills in the ruleset the game reports.
create or replace function public.solitude_upload(payload jsonb)
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
      -- WoW: Forever has no realms, so don't insist they match: prefer the same realm/ruleset, else any
      order by (realm is not null and c->>'realm' is not null and lower(realm) = lower(c->>'realm')) desc, is_main desc
      limit 1;

    if ch.id is null then
      -- New character: add it for them
      insert into characters (owner, name, realm, class, race, level, is_main)
      values (uid, c->>'name', c->>'realm', coalesce(initcap(lower(c->>'class')), 'Warrior'), c->>'race',
              greatest(1, least(100, coalesce((c->>'level')::int, 1))),
              not exists (select 1 from characters where owner = uid))
      returning * into ch;
      stats := jsonb_set(stats, '{chars_added}', to_jsonb((stats->>'chars_added')::int + 1));
    end if;

    if ch.realm is null and c->>'realm' is not null then
      update characters set realm = c->>'realm' where id = ch.id;
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
