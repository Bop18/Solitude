-- Solitude update 4: item icons
-- Run ONCE in Supabase → SQL Editor (paste the contents, then Run).
-- Then on the site: open any dungeon → bottom of the page → "Reload game item data".

alter table public.items add column if not exists icon text;
