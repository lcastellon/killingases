ALTER TABLE public.poker_tables
  ADD COLUMN IF NOT EXISTS is_stable boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.touch_poker_table_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_table_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    affected_table_id := OLD.table_id;
  ELSE
    affected_table_id := NEW.table_id;
  END IF;

  UPDATE public.poker_tables
  SET updated_at = now()
  WHERE id = affected_table_id
    AND status <> 'closed';

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS poker_hands_insert_touch_table ON public.hands;
CREATE TRIGGER poker_hands_insert_touch_table
AFTER INSERT ON public.hands
FOR EACH ROW EXECUTE FUNCTION public.touch_poker_table_activity();

DROP TRIGGER IF EXISTS poker_hands_update_touch_table ON public.hands;
CREATE TRIGGER poker_hands_update_touch_table
AFTER UPDATE OF updated_at ON public.hands
FOR EACH ROW EXECUTE FUNCTION public.touch_poker_table_activity();

DROP TRIGGER IF EXISTS table_players_join_leave_touch_table ON public.table_players;
CREATE TRIGGER table_players_join_leave_touch_table
AFTER INSERT OR DELETE ON public.table_players
FOR EACH ROW EXECUTE FUNCTION public.touch_poker_table_activity();

DROP TRIGGER IF EXISTS table_players_game_update_touch_table ON public.table_players;
CREATE TRIGGER table_players_game_update_touch_table
AFTER UPDATE OF chips, seat, sitting_out ON public.table_players
FOR EACH ROW EXECUTE FUNCTION public.touch_poker_table_activity();

CREATE INDEX IF NOT EXISTS poker_tables_inactivity_idx
  ON public.poker_tables (updated_at)
  WHERE status <> 'closed' AND is_stable = false;

CREATE OR REPLACE FUNCTION public.close_inactive_poker_tables(idle_minutes integer DEFAULT 10)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stale_table record;
  closed_count integer := 0;
BEGIN
  FOR stale_table IN
    SELECT id
    FROM public.poker_tables
    WHERE status <> 'closed'
      AND is_stable = false
      AND updated_at <= now() - make_interval(mins => GREATEST(1, idle_minutes))
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.poker_tables
    SET status = 'closed', updated_at = now()
    WHERE id = stale_table.id
      AND status <> 'closed'
      AND is_stable = false
      AND updated_at <= now() - make_interval(mins => GREATEST(1, idle_minutes));

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    WITH latest_state AS (
      SELECT hs.state
      FROM public.hands h
      JOIN public.hand_secrets hs ON hs.hand_id = h.id
      WHERE h.table_id = stale_table.id
      ORDER BY h.hand_no DESC
      LIMIT 1
    ), committed AS (
      SELECT
        (player ->> 'userId')::uuid AS user_id,
        GREATEST(0, COALESCE((player ->> 'committed')::integer, 0)) AS amount
      FROM latest_state
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE
          WHEN COALESCE((latest_state.state ->> 'complete')::boolean, false)
            THEN '[]'::jsonb
          ELSE COALESCE(latest_state.state -> 'players', '[]'::jsonb)
        END
      ) AS player
    ), refunds AS (
      SELECT
        tp.user_id,
        SUM(tp.chips + COALESCE(committed.amount, 0))::integer AS amount
      FROM public.table_players tp
      LEFT JOIN committed ON committed.user_id = tp.user_id
      WHERE tp.table_id = stale_table.id
      GROUP BY tp.user_id
    )
    UPDATE public.profiles profile
    SET bank_chips = profile.bank_chips + refunds.amount
    FROM refunds
    WHERE profile.id = refunds.user_id
      AND refunds.amount > 0;

    UPDATE public.table_players
    SET chips = 0, seat = NULL
    WHERE table_id = stale_table.id;

    closed_count := closed_count + 1;
  END LOOP;

  RETURN closed_count;
END;
$$;

REVOKE ALL ON FUNCTION public.close_inactive_poker_tables(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_inactive_poker_tables(integer) TO service_role;