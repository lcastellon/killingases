-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'Jugador',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
             NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
             NULLIF(NEW.raw_user_meta_data->>'name', ''),
             split_part(COALESCE(NEW.email, 'Jugador'), '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- tables
CREATE TABLE public.poker_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT 'Mesa Mata Ases',
  host_id UUID NOT NULL,
  small_blind INTEGER NOT NULL DEFAULT 25,
  big_blind INTEGER NOT NULL DEFAULT 50,
  starting_chips INTEGER NOT NULL DEFAULT 5000,
  status TEXT NOT NULL DEFAULT 'lobby',
  button_seat INTEGER,
  hand_no INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.poker_tables TO authenticated;
GRANT ALL ON public.poker_tables TO service_role;
ALTER TABLE public.poker_tables ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.table_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES public.poker_tables ON DELETE CASCADE,
  user_id UUID NOT NULL,
  seat INTEGER NOT NULL,
  display_name TEXT NOT NULL,
  chips INTEGER NOT NULL DEFAULT 0,
  sitting_out BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (table_id, user_id),
  UNIQUE (table_id, seat)
);
GRANT SELECT ON public.table_players TO authenticated;
GRANT ALL ON public.table_players TO service_role;
ALTER TABLE public.table_players ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_at_table(_table_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.table_players
    WHERE table_id = _table_id AND user_id = _user_id
  );
$$;

CREATE POLICY "poker_tables_select_visible" ON public.poker_tables
FOR SELECT TO authenticated
USING (status = 'lobby' OR host_id = auth.uid() OR public.is_at_table(id, auth.uid()));

CREATE POLICY "table_players_select_members" ON public.table_players
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_at_table(table_id, auth.uid()));

-- hands (public state only)
CREATE TABLE public.hands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES public.poker_tables ON DELETE CASCADE,
  hand_no INTEGER NOT NULL,
  public_state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (table_id, hand_no)
);
GRANT SELECT ON public.hands TO authenticated;
GRANT ALL ON public.hands TO service_role;
ALTER TABLE public.hands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hands_select_members" ON public.hands
FOR SELECT TO authenticated
USING (public.is_at_table(table_id, auth.uid()));

-- hand secrets: server only, no authenticated grant
CREATE TABLE public.hand_secrets (
  hand_id UUID PRIMARY KEY REFERENCES public.hands ON DELETE CASCADE,
  state JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.hand_secrets TO service_role;
ALTER TABLE public.hand_secrets ENABLE ROW LEVEL SECURITY;

-- private hole cards
CREATE TABLE public.hand_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hand_id UUID NOT NULL REFERENCES public.hands ON DELETE CASCADE,
  user_id UUID NOT NULL,
  seat INTEGER NOT NULL,
  cards TEXT[] NOT NULL,
  UNIQUE (hand_id, user_id)
);
GRANT SELECT ON public.hand_cards TO authenticated;
GRANT ALL ON public.hand_cards TO service_role;
ALTER TABLE public.hand_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hand_cards_select_own" ON public.hand_cards
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- realtime
ALTER TABLE public.poker_tables REPLICA IDENTITY FULL;
ALTER TABLE public.table_players REPLICA IDENTITY FULL;
ALTER TABLE public.hands REPLICA IDENTITY FULL;
ALTER TABLE public.hand_cards REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.poker_tables;
ALTER PUBLICATION supabase_realtime ADD TABLE public.table_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hands;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hand_cards;