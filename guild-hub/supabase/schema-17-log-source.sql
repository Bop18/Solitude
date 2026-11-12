-- Solitude update 17: tell apart logs pasted for the group from logs found for one person's character
-- Paste ALL of this into Supabase → SQL Editor → New query → Run (choose "Run without RLS").
-- Safe to run more than once.

alter table public.logs add column if not exists auto boolean not null default false;

-- Logs that were found by searching a character (and that nobody pasted) are personal
update public.logs set auto = true
where not auto
  and cardinality(found_for) > 0
  and event_id is null
  and (data is null or updated_at > created_at + interval '5 seconds');

create index if not exists logs_auto_idx on public.logs (auto);
