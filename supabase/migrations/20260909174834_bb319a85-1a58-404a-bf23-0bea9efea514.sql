ALTER TABLE public.poker_tables
  ADD COLUMN IF NOT EXISTS table_mode text NOT NULL DEFAULT 'cash';

ALTER TABLE public.poker_tables
  DROP CONSTRAINT IF EXISTS poker_tables_table_mode_check;
ALTER TABLE public.poker_tables
  ADD CONSTRAINT poker_tables_table_mode_check
  CHECK (table_mode IN ('cash', 'tournament'));

CREATE TABLE IF NOT EXISTS public.tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL UNIQUE REFERENCES public.poker_tables(id) ON DELETE CASCADE,
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  format text NOT NULL CHECK (format IN ('sit_go', 'scheduled')),
  status text NOT NULL DEFAULT 'registering'
    CHECK (status IN ('registering', 'running', 'completed', 'cancelled')),
  buy_in integer NOT NULL CHECK (buy_in > 0),
  house_fee_percent numeric(5,2) NOT NULL DEFAULT 10
    CHECK (house_fee_percent BETWEEN 0 AND 30),
  starting_stack integer NOT NULL CHECK (starting_stack > 0),
  min_players integer NOT NULL CHECK (min_players BETWEEN 2 AND 8),
  max_players integer NOT NULL CHECK (max_players BETWEEN 2 AND 8),
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  allow_rebuys boolean NOT NULL DEFAULT false,
  max_rebuys integer NOT NULL DEFAULT 0 CHECK (max_rebuys BETWEEN 0 AND 10),
  rebuy_until_level integer NOT NULL DEFAULT 0 CHECK (rebuy_until_level BETWEEN 0 AND 50),
  blind_interval_minutes integer NOT NULL DEFAULT 10
    CHECK (blind_interval_minutes BETWEEN 1 AND 180),
  blind_levels jsonb NOT NULL,
  prize_structure jsonb NOT NULL,
  current_level integer NOT NULL DEFAULT 1,
  entries_count integer NOT NULL DEFAULT 0,
  remaining_players integer NOT NULL DEFAULT 0,
  prize_pool integer NOT NULL DEFAULT 0,
  house_fee_total integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  winner_user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (min_players <= max_players),
  CHECK (jsonb_typeof(blind_levels) = 'array'),
  CHECK (jsonb_typeof(prize_structure) = 'array')
);

CREATE TABLE IF NOT EXISTS public.tournament_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'registered'
    CHECK (status IN ('registered', 'active', 'rebuy_pending', 'eliminated', 'winner', 'cancelled')),
  seat smallint NOT NULL CHECK (seat BETWEEN 0 AND 7),
  rebuys integer NOT NULL DEFAULT 0,
  total_paid integer NOT NULL DEFAULT 0,
  finish_position integer,
  prize_amount integer NOT NULL DEFAULT 0,
  registered_at timestamptz NOT NULL DEFAULT now(),
  eliminated_at timestamptz,
  paid_at timestamptz,
  UNIQUE (tournament_id, user_id),
  UNIQUE (tournament_id, seat)
);

CREATE INDEX IF NOT EXISTS tournaments_status_idx
  ON public.tournaments (status, registration_closes_at);
CREATE INDEX IF NOT EXISTS tournament_entries_status_idx
  ON public.tournament_entries (tournament_id, status);

ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_entries ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.tournaments, public.tournament_entries TO service_role;
REVOKE ALL ON public.tournaments, public.tournament_entries FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.register_tournament_entry(
  _tournament_id uuid,
  _user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  tournament_row public.tournaments%ROWTYPE;
  profile_row public.profiles%ROWTYPE;
  chosen_seat integer;
  fee integer;
  prize_contribution integer;
  next_count integer;
BEGIN
  SELECT * INTO tournament_row
  FROM public.tournaments
  WHERE id = _tournament_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Torneo no encontrado'; END IF;
  IF tournament_row.status <> 'registering' THEN
    RAISE EXCEPTION 'La inscripción ya está cerrada';
  END IF;
  IF tournament_row.registration_opens_at IS NOT NULL
     AND now() < tournament_row.registration_opens_at THEN
    RAISE EXCEPTION 'La inscripción todavía no comienza';
  END IF;
  IF tournament_row.registration_closes_at IS NOT NULL
     AND now() >= tournament_row.registration_closes_at THEN
    RAISE EXCEPTION 'La inscripción ya terminó';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.tournament_entries
    WHERE tournament_id = _tournament_id AND user_id = _user_id
  ) THEN
    RAISE EXCEPTION 'Ya estás inscrito en este torneo';
  END IF;
  IF tournament_row.entries_count >= tournament_row.max_players THEN
    RAISE EXCEPTION 'El torneo ya está lleno';
  END IF;

  SELECT * INTO profile_row
  FROM public.profiles
  WHERE id = _user_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil no encontrado'; END IF;
  IF profile_row.bank_chips < tournament_row.buy_in THEN
    RAISE EXCEPTION 'No tienes suficientes fichas en tu banco';
  END IF;

  SELECT candidate INTO chosen_seat
  FROM generate_series(0, tournament_row.max_players - 1) AS seats(candidate)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.tournament_entries
    WHERE tournament_id = _tournament_id AND seat = candidate
  )
  ORDER BY random()
  LIMIT 1;
  IF chosen_seat IS NULL THEN RAISE EXCEPTION 'No quedan asientos disponibles'; END IF;

  fee := floor(tournament_row.buy_in * tournament_row.house_fee_percent / 100.0);
  prize_contribution := tournament_row.buy_in - fee;
  next_count := tournament_row.entries_count + 1;

  UPDATE public.profiles
  SET bank_chips = bank_chips - tournament_row.buy_in
  WHERE id = _user_id;

  INSERT INTO public.tournament_entries (
    tournament_id, user_id, display_name, seat, total_paid
  ) VALUES (
    _tournament_id, _user_id, profile_row.display_name, chosen_seat, tournament_row.buy_in
  );

  INSERT INTO public.table_players (
    table_id, user_id, seat, display_name, chips, sitting_out
  ) VALUES (
    tournament_row.table_id, _user_id, chosen_seat, profile_row.display_name,
    tournament_row.starting_stack, false
  )
  ON CONFLICT (table_id, user_id) DO UPDATE SET
    seat = EXCLUDED.seat,
    display_name = EXCLUDED.display_name,
    chips = EXCLUDED.chips,
    sitting_out = false;

  UPDATE public.tournaments
  SET entries_count = next_count,
      remaining_players = remaining_players + 1,
      prize_pool = prize_pool + prize_contribution,
      house_fee_total = house_fee_total + fee,
      status = CASE
        WHEN format = 'sit_go' AND next_count >= max_players THEN 'running'
        ELSE status
      END,
      started_at = CASE
        WHEN format = 'sit_go' AND next_count >= max_players THEN now()
        ELSE started_at
      END,
      updated_at = now()
  WHERE id = _tournament_id;

  IF tournament_row.format = 'sit_go' AND next_count >= tournament_row.max_players THEN
    UPDATE public.tournament_entries
    SET status = 'active'
    WHERE tournament_id = _tournament_id AND status = 'registered';
  END IF;

  RETURN jsonb_build_object(
    'seat', chosen_seat,
    'bankChips', profile_row.bank_chips - tournament_row.buy_in,
    'started', tournament_row.format = 'sit_go' AND next_count >= tournament_row.max_players
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.unregister_tournament_entry(
  _tournament_id uuid,
  _user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  tournament_row public.tournaments%ROWTYPE;
  entry_row public.tournament_entries%ROWTYPE;
  fee integer;
BEGIN
  SELECT * INTO tournament_row FROM public.tournaments
  WHERE id = _tournament_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Torneo no encontrado'; END IF;
  IF tournament_row.status <> 'registering' THEN
    RAISE EXCEPTION 'Ya no puedes cancelar la inscripción';
  END IF;

  SELECT * INTO entry_row FROM public.tournament_entries
  WHERE tournament_id = _tournament_id AND user_id = _user_id
  FOR UPDATE;
  IF NOT FOUND OR entry_row.status <> 'registered' THEN
    RAISE EXCEPTION 'No tienes una inscripción activa';
  END IF;

  fee := floor(entry_row.total_paid * tournament_row.house_fee_percent / 100.0);
  UPDATE public.profiles
  SET bank_chips = bank_chips + entry_row.total_paid
  WHERE id = _user_id;
  UPDATE public.table_players
  SET seat = NULL, chips = 0
  WHERE table_id = tournament_row.table_id AND user_id = _user_id;
  DELETE FROM public.tournament_entries WHERE id = entry_row.id;
  UPDATE public.tournaments
  SET entries_count = GREATEST(0, entries_count - 1),
      remaining_players = GREATEST(0, remaining_players - 1),
      prize_pool = GREATEST(0, prize_pool - (entry_row.total_paid - fee)),
      house_fee_total = GREATEST(0, house_fee_total - fee),
      updated_at = now()
  WHERE id = _tournament_id;

  RETURN jsonb_build_object('refunded', entry_row.total_paid);
END;
$$;

CREATE OR REPLACE FUNCTION public.rebuy_tournament_entry(
  _tournament_id uuid,
  _user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  tournament_row public.tournaments%ROWTYPE;
  entry_row public.tournament_entries%ROWTYPE;
  profile_row public.profiles%ROWTYPE;
  fee integer;
BEGIN
  SELECT * INTO tournament_row FROM public.tournaments
  WHERE id = _tournament_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Torneo no encontrado'; END IF;
  IF tournament_row.status <> 'running' OR NOT tournament_row.allow_rebuys THEN
    RAISE EXCEPTION 'Este torneo es freezeout';
  END IF;
  IF tournament_row.current_level > tournament_row.rebuy_until_level THEN
    RAISE EXCEPTION 'El periodo de rebuys ya terminó';
  END IF;

  SELECT * INTO entry_row FROM public.tournament_entries
  WHERE tournament_id = _tournament_id AND user_id = _user_id
  FOR UPDATE;
  IF NOT FOUND OR entry_row.status <> 'rebuy_pending' THEN
    RAISE EXCEPTION 'No tienes un rebuy pendiente';
  END IF;
  IF entry_row.rebuys >= tournament_row.max_rebuys THEN
    RAISE EXCEPTION 'Ya utilizaste todos tus rebuys';
  END IF;

  SELECT * INTO profile_row FROM public.profiles
  WHERE id = _user_id FOR UPDATE;
  IF profile_row.bank_chips < tournament_row.buy_in THEN
    RAISE EXCEPTION 'No tienes suficientes fichas en tu banco';
  END IF;

  fee := floor(tournament_row.buy_in * tournament_row.house_fee_percent / 100.0);
  UPDATE public.profiles
  SET bank_chips = bank_chips - tournament_row.buy_in
  WHERE id = _user_id;
  UPDATE public.tournament_entries
  SET status = 'active', rebuys = rebuys + 1,
      total_paid = total_paid + tournament_row.buy_in,
      finish_position = NULL, eliminated_at = NULL
  WHERE id = entry_row.id;
  UPDATE public.table_players
  SET seat = entry_row.seat, chips = tournament_row.starting_stack, sitting_out = false
  WHERE table_id = tournament_row.table_id AND user_id = _user_id;
  UPDATE public.tournaments
  SET remaining_players = remaining_players + 1,
      prize_pool = prize_pool + (tournament_row.buy_in - fee),
      house_fee_total = house_fee_total + fee,
      updated_at = now()
  WHERE id = _tournament_id;

  RETURN jsonb_build_object(
    'chips', tournament_row.starting_stack,
    'bankChips', profile_row.bank_chips - tournament_row.buy_in
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_tournament_if_registering(_tournament_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  tournament_row public.tournaments%ROWTYPE;
BEGIN
  SELECT * INTO tournament_row FROM public.tournaments
  WHERE id = _tournament_id FOR UPDATE;
  IF NOT FOUND OR tournament_row.status <> 'registering' THEN RETURN false; END IF;

  UPDATE public.profiles AS profile
  SET bank_chips = profile.bank_chips + refunds.amount
  FROM (
    SELECT user_id, sum(total_paid)::integer AS amount
    FROM public.tournament_entries
    WHERE tournament_id = _tournament_id
    GROUP BY user_id
  ) AS refunds
  WHERE profile.id = refunds.user_id;

  UPDATE public.tournament_entries
  SET status = 'cancelled'
  WHERE tournament_id = _tournament_id;
  UPDATE public.table_players
  SET seat = NULL, chips = 0
  WHERE table_id = tournament_row.table_id;
  UPDATE public.tournaments
  SET status = 'cancelled', completed_at = now(), updated_at = now()
  WHERE id = _tournament_id;
  UPDATE public.poker_tables
  SET status = 'tournament_cancelled', updated_at = now()
  WHERE id = tournament_row.table_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_tournament_rebuy(
  _tournament_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.tournament_entries
  SET status = 'eliminated'
  WHERE tournament_id = _tournament_id
    AND user_id = _user_id
    AND status = 'rebuy_pending';
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_tournament_if_ready(_tournament_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  tournament_row public.tournaments%ROWTYPE;
  champion_id uuid;
  prize_row jsonb;
  place_no integer;
  prize_percent numeric;
  prize_value integer;
  recipient_id uuid;
  awarded integer := 0;
  remainder integer;
BEGIN
  SELECT * INTO tournament_row FROM public.tournaments
  WHERE id = _tournament_id FOR UPDATE;
  IF NOT FOUND OR tournament_row.status <> 'running' THEN RETURN false; END IF;
  IF EXISTS (
    SELECT 1 FROM public.tournament_entries
    WHERE tournament_id = _tournament_id AND status = 'rebuy_pending'
  ) THEN RETURN false; END IF;
  IF (SELECT count(*) FROM public.tournament_entries
      WHERE tournament_id = _tournament_id AND status = 'active') <> 1 THEN
    RETURN false;
  END IF;

  SELECT user_id INTO champion_id FROM public.tournament_entries
  WHERE tournament_id = _tournament_id AND status = 'active'
  LIMIT 1;
  UPDATE public.tournament_entries
  SET status = 'winner', finish_position = 1, eliminated_at = now()
  WHERE tournament_id = _tournament_id AND user_id = champion_id;
  UPDATE public.tournaments
  SET status = 'completed', remaining_players = 1,
      winner_user_id = champion_id, completed_at = now(), updated_at = now()
  WHERE id = _tournament_id;

  FOR prize_row IN SELECT value FROM jsonb_array_elements(tournament_row.prize_structure)
  LOOP
    place_no := (prize_row ->> 'place')::integer;
    prize_percent := (prize_row ->> 'percent')::numeric;
    prize_value := floor(tournament_row.prize_pool * prize_percent / 100.0);
    SELECT user_id INTO recipient_id FROM public.tournament_entries
    WHERE tournament_id = _tournament_id AND finish_position = place_no
    LIMIT 1;
    IF recipient_id IS NOT NULL AND prize_value > 0 THEN
      UPDATE public.profiles SET bank_chips = bank_chips + prize_value WHERE id = recipient_id;
      UPDATE public.tournament_entries
      SET prize_amount = prize_amount + prize_value, paid_at = now()
      WHERE tournament_id = _tournament_id AND user_id = recipient_id;
      awarded := awarded + prize_value;
    END IF;
    recipient_id := NULL;
  END LOOP;

  remainder := tournament_row.prize_pool - awarded;
  IF remainder > 0 THEN
    UPDATE public.profiles SET bank_chips = bank_chips + remainder WHERE id = champion_id;
    UPDATE public.tournament_entries
    SET prize_amount = prize_amount + remainder, paid_at = now()
    WHERE tournament_id = _tournament_id AND user_id = champion_id;
  END IF;

  UPDATE public.poker_tables
  SET status = 'tournament_complete', updated_at = now()
  WHERE id = tournament_row.table_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.register_tournament_entry(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.unregister_tournament_entry(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rebuy_tournament_entry(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decline_tournament_rebuy(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_tournament_if_ready(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_tournament_if_registering(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_tournament_entry(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.unregister_tournament_entry(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.rebuy_tournament_entry(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.decline_tournament_rebuy(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_tournament_if_ready(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_tournament_if_registering(uuid) TO service_role;