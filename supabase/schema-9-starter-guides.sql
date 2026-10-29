-- Solitude update 9: room for the starter guides.
-- Paste ALL of this into Supabase → SQL Editor → New query → Run.
-- Then on the site: Dungeons → "Load starter guides".
-- This file creates no tables. If Supabase warns about RLS, "Run without RLS" is fine.

alter table public.dungeons
  add column if not exists guide_where text,
  add column if not exists guide_overview text,
  add column if not exists guide_before text,
  add column if not exists guide_route jsonb,
  add column if not exists guide_tips text;

-- 'guide' = Solitude's starter guide, 'group' = written or edited by your group
alter table public.boss_notes add column if not exists source text not null default 'group';

create or replace function public.touch_edited()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  if auth.uid() is not null and tg_table_name = 'boss_notes' then
    new.updated_by := auth.uid();
    new.source := 'group';
  end if;
  return new;
end; $$;
