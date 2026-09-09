-- RLS activado sin política: hand_secrets solo es accedida por service_role/admin.
-- Añadimos una política explícita de denegación para que la API pública no vea filas.
DROP POLICY IF EXISTS "hand_secrets_deny_all" ON public.hand_secrets;
CREATE POLICY "hand_secrets_deny_all"
ON public.hand_secrets
FOR ALL
TO authenticated, anon
USING (false)
WITH CHECK (false);

-- Creamos un esquema no expuesto por la API para funciones auxiliares de políticas.
CREATE SCHEMA IF NOT EXISTS private;

-- Movemos is_at_table a private para que no sea invocable directamente por authenticated
-- desde PostgREST, pero siga siendo usable dentro de las políticas RLS.
CREATE OR REPLACE FUNCTION private.is_at_table(_table_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.table_players
    WHERE table_id = _table_id AND user_id = _user_id
  )
$$;

-- Actualizamos las políticas para usar la versión privada.
DROP POLICY IF EXISTS "poker_tables_select_visible" ON public.poker_tables;
CREATE POLICY "poker_tables_select_visible"
ON public.poker_tables
FOR SELECT
TO authenticated
USING ((status = 'lobby') OR (host_id = auth.uid()) OR private.is_at_table(id, auth.uid()));

DROP POLICY IF EXISTS "hands_select_members" ON public.hands;
CREATE POLICY "hands_select_members"
ON public.hands
FOR SELECT
TO authenticated
USING (private.is_at_table(table_id, auth.uid()));

DROP POLICY IF EXISTS "table_players_select_members" ON public.table_players;
CREATE POLICY "table_players_select_members"
ON public.table_players
FOR SELECT
TO authenticated
USING ((user_id = auth.uid()) OR private.is_at_table(table_id, auth.uid()));

DROP POLICY IF EXISTS "table_messages_select_members" ON public.table_messages;
CREATE POLICY "table_messages_select_members"
ON public.table_messages
FOR SELECT
TO authenticated
USING (private.is_at_table(table_id, auth.uid()));

-- Eliminamos la versión pública antigua para que no sea expuesta por la API.
DROP FUNCTION IF EXISTS public.is_at_table(uuid, uuid);

-- Permisos mínimos necesarios para que las políticas puedan invocar la función.
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT EXECUTE ON FUNCTION private.is_at_table(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_at_table(uuid, uuid) TO service_role;