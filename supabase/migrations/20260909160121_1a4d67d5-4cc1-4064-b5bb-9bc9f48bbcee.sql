CREATE TABLE IF NOT EXISTS public.table_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.poker_tables(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT table_messages_body_length
    CHECK (char_length(btrim(body)) BETWEEN 1 AND 280)
);

CREATE INDEX IF NOT EXISTS table_messages_table_created_idx
  ON public.table_messages (table_id, created_at DESC);

ALTER TABLE public.table_messages ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.table_messages TO authenticated;
GRANT ALL ON public.table_messages TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.table_messages FROM authenticated, anon;

DROP POLICY IF EXISTS "table_messages_select_members" ON public.table_messages;
CREATE POLICY "table_messages_select_members"
ON public.table_messages
FOR SELECT
TO authenticated
USING (public.is_at_table(table_id, auth.uid()));

DROP POLICY IF EXISTS "table_messages_insert_members" ON public.table_messages;

ALTER TABLE public.table_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'table_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.table_messages;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS table_messages_insert_touch_table ON public.table_messages;
CREATE TRIGGER table_messages_insert_touch_table
AFTER INSERT ON public.table_messages
FOR EACH ROW EXECUTE FUNCTION public.touch_poker_table_activity();