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
    const notify = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        handler.current();
      }, 250);
    };

    const channel = supabase
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

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [tableId]);
}
