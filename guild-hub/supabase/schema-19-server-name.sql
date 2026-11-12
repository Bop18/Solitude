-- The exact in-game realm (e.g. "CAMWOW EU5 Realm 4 PvP"), filled in when you paste from the addon.
-- Battle.net Sync tries it first. Safe to run more than once.
alter table public.characters add column if not exists server_name text;
