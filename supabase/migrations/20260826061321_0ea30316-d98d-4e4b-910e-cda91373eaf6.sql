ALTER TABLE public.poker_tables
  ADD COLUMN IF NOT EXISTS min_buyin integer NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS max_buyin integer NOT NULL DEFAULT 20000;

ALTER TABLE public.table_players
  ALTER COLUMN seat DROP NOT NULL,
  ALTER COLUMN chips SET DEFAULT 0;

ALTER TABLE public.table_players DROP CONSTRAINT IF EXISTS table_players_table_id_seat_key;
DROP INDEX IF EXISTS table_players_table_id_seat_key;
CREATE UNIQUE INDEX IF NOT EXISTS table_players_seat_unique
  ON public.table_players (table_id, seat)
  WHERE seat IS NOT NULL;