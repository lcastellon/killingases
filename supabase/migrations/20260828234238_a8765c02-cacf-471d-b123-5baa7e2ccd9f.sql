ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bank_chips integer NOT NULL DEFAULT 0;

WITH closed AS (
  SELECT tp.user_id, SUM(tp.chips)::int AS total
  FROM public.table_players tp
  JOIN public.poker_tables t ON t.id = tp.table_id
  WHERE t.status = 'closed'
  GROUP BY tp.user_id
)
UPDATE public.profiles p
SET bank_chips = p.bank_chips + closed.total
FROM closed
WHERE closed.user_id = p.id;

UPDATE public.table_players tp
SET chips = 0, seat = NULL
FROM public.poker_tables t
WHERE t.id = tp.table_id AND t.status = 'closed' AND tp.chips <> 0;