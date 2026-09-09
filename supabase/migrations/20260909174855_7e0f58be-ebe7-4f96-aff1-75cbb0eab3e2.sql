CREATE POLICY "tournaments_deny_all" ON public.tournaments
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "tournament_entries_deny_all" ON public.tournament_entries
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);