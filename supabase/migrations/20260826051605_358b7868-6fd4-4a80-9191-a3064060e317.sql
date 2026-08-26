ALTER TABLE public.poker_tables
  ADD COLUMN IF NOT EXISTS turn_seconds integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS game_variant text NOT NULL DEFAULT 'omaha',
  ADD COLUMN IF NOT EXISTS special_rules jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.table_players
  ADD COLUMN IF NOT EXISTS last_seen_at timestamp with time zone NOT NULL DEFAULT now();