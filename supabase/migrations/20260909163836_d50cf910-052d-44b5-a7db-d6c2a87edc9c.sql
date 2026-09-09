CREATE TABLE IF NOT EXISTS public.table_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.poker_tables(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seat smallint NOT NULL CHECK (seat BETWEEN 0 AND 8),
  reaction text NOT NULL CHECK (
    reaction IN ('thumbs_up', 'laugh', 'shock', 'fire', 'clap', 'angry')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '4 seconds')
);

CREATE INDEX IF NOT EXISTS table_reactions_table_created_idx
  ON public.table_reactions (table_id, created_at DESC);

CREATE INDEX IF NOT EXISTS table_reactions_expiration_idx
  ON public.table_reactions (expires_at);

ALTER TABLE public.table_reactions ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.table_reactions TO authenticated;
GRANT ALL ON public.table_reactions TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.table_reactions FROM authenticated, anon;

DROP POLICY IF EXISTS "table_reactions_select_members" ON public.table_reactions;
CREATE POLICY "table_reactions_select_members"
ON public.table_reactions
FOR SELECT
TO authenticated
USING (private.is_at_table(table_id, auth.uid()));

ALTER TABLE public.table_reactions REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'table_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.table_reactions;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS table_reactions_insert_touch_table ON public.table_reactions;
CREATE TRIGGER table_reactions_insert_touch_table
AFTER INSERT ON public.table_reactions
FOR EACH ROW EXECUTE FUNCTION public.touch_poker_table_activity();