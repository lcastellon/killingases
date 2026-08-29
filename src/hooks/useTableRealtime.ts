import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Re-fetches the table snapshot whenever the backend pushes a change.
 * El callback se guarda en un ref para que el canal no se vuelva a suscribir
 * en cada render, y los avisos se agrupan (250ms) para evitar ráfagas.
 */
export function useTableRealtime(tableId: string | undefined, onChange: () => void) {
  const handler = useRef(onChange);
  handler.current = onChange;

  useEffect(() => {
    if (!tableId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const notify = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        handler.current();
      }, 250);
    };

    void (async () => {
      // Sin token, el socket es anónimo y RLS bloquea la entrega de cambios:
      // la mesa solo se actualizaría por sondeo.
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) await supabase.realtime.setAuth(token);
      if (cancelled) return;

      channel = supabase
        .channel(`mesa-${tableId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "hands", filter: `table_id=eq.${tableId}` },
          notify,
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "table_players", filter: `table_id=eq.${tableId}` },
          notify,
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "poker_tables", filter: `id=eq.${tableId}` },
          notify,
        )
        .on("postgres_changes", { event: "*", schema: "public", table: "hand_cards" }, notify)
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [tableId]);

}
