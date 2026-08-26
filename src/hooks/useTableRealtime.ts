import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Re-fetches the table snapshot whenever the backend pushes a change. */
export function useTableRealtime(tableId: string | undefined, onChange: () => void) {
  useEffect(() => {
    if (!tableId) return;
    const channel = supabase
      .channel(`mesa-${tableId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hands", filter: `table_id=eq.${tableId}` },
        onChange,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "table_players", filter: `table_id=eq.${tableId}` },
        onChange,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "poker_tables", filter: `id=eq.${tableId}` },
        onChange,
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "hand_cards" }, onChange)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tableId, onChange]);
}
