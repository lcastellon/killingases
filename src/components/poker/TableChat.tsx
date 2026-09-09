import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { TABLE_CHAT_MAX_LENGTH } from "@/lib/poker/chat";
import {
  listTableMessages,
  sendTableMessage,
  type TableChatMessage,
} from "@/lib/poker/chat.functions";
import { cn } from "@/lib/utils";

function messageTime(value: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function TableChat({
  tableId,
  code,
  currentUserId,
}: {
  tableId: string;
  code: string;
  currentUserId: string;
}) {
  const list = useServerFn(listTableMessages);
  const sendMessage = useServerFn(sendTableMessage);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryKey = useMemo(() => ["table-chat", tableId] as const, [tableId]);

  const query = useQuery({
    queryKey,
    queryFn: () => list({ data: { code } }),
    staleTime: 0,
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) await supabase.realtime.setAuth(token);
      if (cancelled) return;

      channel = supabase
        .channel(`table-chat-${tableId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "table_messages",
            filter: `table_id=eq.${tableId}`,
          },
          () => void queryClient.invalidateQueries({ queryKey }),
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [queryClient, queryKey, tableId]);

  useEffect(() => {
    if (!open || !query.data?.length) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [open, query.data?.length]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      const message = await sendMessage({ data: { code, body: draft } });
      queryClient.setQueryData<TableChatMessage[]>(queryKey, (current = []) =>
        current.some((item) => item.id === message.id) ? current : [...current, message],
      );
      setDraft("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos enviar el mensaje");
    } finally {
      setSending(false);
    }
  };

  const messages = query.data ?? [];

  return (
    <section className="mt-3 overflow-hidden rounded-2xl border border-border/60 bg-card/70 sm:mt-5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/20"
      >
        <MessageCircle className="h-4 w-4 text-primary" aria-hidden="true" />
        <span className="font-display tracking-wide text-foreground">Chat de la mesa</span>
        {messages.length > 0 && (
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[0.65rem] text-primary">
            {messages.length}
          </span>
        )}
        <ChevronDown
          className={cn(
            "ml-auto h-4 w-4 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="border-t border-border/50">
          <div
            className="max-h-52 min-h-24 space-y-2 overflow-y-auto px-3 py-3"
            aria-live="polite"
            aria-label="Mensajes del chat"
          >
            {query.isLoading ? (
              <p className="py-5 text-center text-xs text-muted-foreground">Abriendo el chat…</p>
            ) : query.isError ? (
              <p className="py-5 text-center text-xs text-chip-red">
                El chat todavía no está disponible en esta mesa.
              </p>
            ) : messages.length === 0 ? (
              <p className="py-5 text-center text-xs text-muted-foreground">
                Aún no hay mensajes. Saluda a la mesa.
              </p>
            ) : (
              messages.map((message) => {
                const mine = message.userId === currentUserId;
                return (
                  <div
                    key={message.id}
                    className={cn("flex", mine ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[86%] rounded-2xl px-3 py-2 text-sm",
                        mine
                          ? "rounded-br-sm bg-primary text-primary-foreground"
                          : "rounded-bl-sm border border-border/60 bg-background/70 text-foreground",
                      )}
                    >
                      <div
                        className={cn(
                          "mb-0.5 flex items-center gap-2 text-[0.62rem]",
                          mine ? "text-primary-foreground/70" : "text-muted-foreground",
                        )}
                      >
                        <span className="truncate font-semibold">
                          {mine ? "Tú" : message.displayName}
                        </span>
                        <time dateTime={message.createdAt}>{messageTime(message.createdAt)}</time>
                      </div>
                      <p className="break-words leading-snug">{message.body}</p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={submit} className="flex items-end gap-2 border-t border-border/50 p-2.5">
            <div className="min-w-0 flex-1">
              <label htmlFor={`table-chat-input-${tableId}`} className="sr-only">
                Mensaje para la mesa
              </label>
              <input
                id={`table-chat-input-${tableId}`}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={TABLE_CHAT_MAX_LENGTH}
                disabled={sending || query.isError}
                placeholder="Escribe un mensaje…"
                autoComplete="off"
                className="h-10 w-full rounded-xl border border-input bg-background/80 px-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-brass disabled:opacity-50 sm:text-sm"
              />
              <p className="mt-1 px-1 text-right text-[0.6rem] text-muted-foreground">
                {draft.length}/{TABLE_CHAT_MAX_LENGTH}
              </p>
            </div>
            <button
              type="submit"
              disabled={sending || !draft.trim() || query.isError}
              aria-label="Enviar mensaje"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
