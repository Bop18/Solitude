-- Solitude update 5: syncing gear from the game
-- Paste ALL of this into Supabase → SQL Editor → New query → Run (once).

alter table public.characters
  add column if not exists synced_at timestamptz,   -- when gear/level last came from the game
  add column if not exists sync_source text;        -- 'battle.net' or 'addon'
