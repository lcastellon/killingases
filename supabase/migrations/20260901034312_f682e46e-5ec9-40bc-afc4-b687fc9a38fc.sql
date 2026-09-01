CREATE TABLE public.house_rake (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_id uuid NOT NULL REFERENCES public.poker_tables(id) ON DELETE CASCADE,
  hand_id uuid NOT NULL REFERENCES public.hands(id) ON DELETE CASCADE,
  hand_no integer NOT NULL,
  pot integer NOT NULL DEFAULT 0,
  amount integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (hand_id)
);

GRANT ALL ON public.house_rake TO service_role;

ALTER TABLE public.house_rake ENABLE ROW LEVEL SECURITY;

CREATE POLICY "house_rake_service_only" ON public.house_rake FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX house_rake_created_at_idx ON public.house_rake (created_at DESC);