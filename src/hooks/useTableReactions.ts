import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { listActiveTableReactions, sendTableReaction } from "@/lib/poker/reaction.functions";
import {
  isTableReactionKey,
  type TableReactionEvent,
  type TableReactionKey,
} from "@/lib/poker/reactions";

type ReactionRealtimeRow = {
  id: string;
  table_id: string;
  user_id: string;
  seat: number;
  reaction: string;
  created_at: string;
  expires_at: string;
};

function fromRealtimeRow(row: ReactionRealtimeRow): TableReactionEvent | null {
  if (!isTableReactionKey(row.reaction)) return null;
  return {
    id: row.id,
    tableId: row.table_id,
    userId: row.user_id,
    seat: row.seat,
    reaction: row.reaction,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

export function useTableReactions(tableId: string | undefined, code: string) {
  const list = useServerFn(listActiveTableReactions);
  const send = useServerFn(sendTableReaction);
  const [bySeat, setBySeat] = useState<Record<number, TableReactionEvent>>({});
  const [sending, setSending] = useState(false);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const show = useCallback((event: TableReactionEvent) => {
    const remaining = new Date(event.expiresAt).getTime() - Date.now();
    if (remaining <= 0) return;

    const currentTimer = timers.current.get(event.seat);
    if (currentTimer) clearTimeout(currentTimer);
    setBySeat((current) => ({ ...current, [event.seat]: event }));
    timers.current.set(
      event.seat,
      setTimeout(() => {
        setBySeat((current) => {
          if (current[event.seat]?.id !== event.id) return current;
          const next = { ...current };
          delete next[event.seat];
          return next;
        });
        timers.current.delete(event.seat);
      }, remaining),
    );
  }, []);

  const initial = useQuery({
    queryKey: ["active-table-reactions", tableId],
    queryFn: () => list({ data: { code } }),
    enabled: Boolean(tableId),
    staleTime: Number.POSITIVE_INFINITY,
    retry: 1,
  });

  useEffect(() => {
    initial.data?.forEach(show);
  }, [initial.data, show]);

  useEffect(() => {
    if (!tableId) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) await supabase.realtime.setAuth(token);
      if (cancelled) return;

      channel = supabase
        .channel(`table-reactions-${tableId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "table_reactions",
            filter: `table_id=eq.${tableId}`,
          },
          (payload) => {
            const event = fromRealtimeRow(payload.new as ReactionRealtimeRow);
            if (event) show(event);
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [show, tableId]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current.clear();
    },
    [],
  );

  const react = useCallback(
    async (reaction: TableReactionKey) => {
      if (sending) return;
      setSending(true);
      try {
        const event = await send({ data: { code, reaction } });
        show(event);
      } finally {
        setSending(false);
      }
    },
    [code, send, sending, show],
  );

  return { reactionsBySeat: bySeat, react, sending };
}
