import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { act, dealHand, getTableSnapshot, joinTable, leaveTable } from "@/lib/poker/table.functions";
import { legalActions, type HandState, type PublicHandState } from "@/lib/poker/engine";
import { evaluateOmaha } from "@/lib/poker/cards";
import { PlayingCard } from "@/components/poker/PlayingCard";
import { Seat, type SeatView } from "@/components/poker/Seat";
import { ActionBar } from "@/components/poker/ActionBar";
import { useTableRealtime } from "@/hooks/useTableRealtime";

export const Route = createFileRoute("/_authenticated/mesa/$codigo")({
  head: ({ params }) => ({
    meta: [
      { title: `Mesa ${params.codigo} — Mata Ases` },
      {
        name: "description",
        content: "Mesa privada de Omaha No Limit en Mata Ases: reparte, apuesta y gana el bote.",
      },
      { property: "og:title", content: `Mesa ${params.codigo} — Mata Ases` },
      {
        property: "og:description",
        content: "Únete a esta mesa de Omaha No Limit con el código y juega con tus amigos.",
      },
    ],
  }),
  component: TableRoom,
});

const STREET_LABEL: Record<string, string> = {
  preflop: "Preflop",
  flop: "Flop",
  turn: "Turn",
  river: "River",
  showdown: "Showdown",
};

function TableRoom() {
  const { codigo } = Route.useParams();
  const navigate = useNavigate();
  const snapshot = useServerFn(getTableSnapshot);
  const deal = useServerFn(dealHand);
  const sendAction = useServerFn(act);
  const join = useServerFn(joinTable);
  const leave = useServerFn(leaveTable);
  const [busy, setBusy] = useState(false);

  const query = useQuery({
    queryKey: ["mesa", codigo],
    queryFn: () => snapshot({ data: { code: codigo } }),
    refetchInterval: 4000,
  });

  const refetch = useCallback(() => {
    void query.refetch();
  }, [query]);

  useTableRealtime(query.data?.table.id, refetch);

  const data = query.data;
  const hand = data?.hand ?? null;

  const seats: SeatView[] = useMemo(() => {
    if (!data) return [];
    return data.players
      .slice()
      .sort((a, b) => a.seat - b.seat)
      .map((p) => {
        const handPlayer = hand?.players.find((hp) => hp.seat === p.seat);
        const revealed = hand?.revealed?.[String(p.seat)] ?? null;
        const isMe = p.userId === data.me.userId;
        const cards = isMe ? (data.myCards ?? revealed) : revealed;
        const winner = hand?.winners?.find((w) => w.seat === p.seat);
        return {
          seat: p.seat,
          name: p.displayName,
          chips: handPlayer?.chips ?? p.chips,
          bet: handPlayer?.bet ?? 0,
          folded: handPlayer?.folded ?? false,
          allIn: handPlayer?.allIn ?? false,
          isTurn: hand?.currentSeat === p.seat,
          isButton: hand ? hand.buttonSeat === p.seat : data.table.buttonSeat === p.seat,
          isMe,
          cards,
          cardCount: handPlayer ? 4 : 0,
          winAmount: winner?.amount,
          handName: winner?.handName,
        } satisfies SeatView;
      });
  }, [data, hand]);

  const legal = useMemo(() => {
    if (!hand || data?.me.seat === null || data?.me.seat === undefined) return null;
    return legalActions(hand as unknown as HandState, data.me.seat);
  }, [hand, data?.me.seat]);

  const myBest = useMemo(() => {
    if (!data?.myCards || !hand || hand.board.length < 3) return null;
    return evaluateOmaha(data.myCards, hand.board);
  }, [data?.myCards, hand]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Acción no permitida");
    } finally {
      setBusy(false);
    }
  };

  if (query.isLoading) {
    return (
      <main className="felt-surface flex min-h-screen items-center justify-center">
        <span className="font-display text-2xl tracking-widest text-primary">REPARTIENDO…</span>
      </main>
    );
  }

  if (query.isError || !data) {
    return (
      <main className="felt-surface flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl text-foreground">No pudimos abrir la mesa {codigo}</h1>
        <p className="text-sm text-muted-foreground">
          Verifica el código con tu amigo o vuelve al inicio.
        </p>
        <Link
          to="/"
          className="rounded-xl bg-primary px-5 py-3 font-display tracking-wide text-primary-foreground"
        >
          Ir al inicio
        </Link>
      </main>
    );
  }

  const amSeated = data.me.seat !== null;
  const canDeal = data.me.isHost && (!hand || hand.complete) && data.players.length >= 2;

  return (
    <main className="felt-surface min-h-screen pb-4">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-4">
        <header className="flex items-center justify-between gap-3">
          <Link to="/" className="font-display text-xl tracking-widest text-primary">
            MATA ASES
          </Link>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(data.table.code);
              toast.success("Código copiado");
            }}
            className="rounded-lg border border-brass-soft/50 bg-card px-3 py-1.5 text-sm"
          >
            Código <span className="font-display tracking-[0.2em] text-primary">{data.table.code}</span>
          </button>
        </header>

        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Ciegas {data.table.smallBlind}/{data.table.bigBlind} · Omaha No Limit
          </span>
          <span>{hand ? `Mano #${hand.handNo} · ${STREET_LABEL[hand.street]}` : "En lobby"}</span>
        </div>

        {/* Mesa */}
        <section className="mt-4 rounded-3xl border border-brass-soft/30 bg-felt-deep/60 p-4 shadow-table">
          <div className="flex flex-wrap items-start justify-center gap-2">
            {seats.map((view) => (
              <Seat key={view.seat} view={view} />
            ))}
          </div>

          <div className="mt-5 flex flex-col items-center gap-3 rounded-2xl border border-felt-line/40 bg-felt/50 py-5">
            <span className="tabular font-display text-3xl text-primary">
              {(hand?.pot ?? 0).toLocaleString("es-MX")}
            </span>
            <span className="-mt-2 text-[0.65rem] uppercase tracking-widest text-muted-foreground">
              Bote
            </span>
            <div className="flex gap-2">
              {Array.from({ length: 5 }).map((_, i) => {
                const card = hand?.board[i];
                return card ? (
                  <PlayingCard key={i} card={card} size="md" />
                ) : (
                  <div
                    key={i}
                    className="h-16 w-11 rounded-md border border-dashed border-felt-line/50"
                  />
                );
              })}
            </div>
          </div>
        </section>

        {/* Mis cartas */}
        {data.myCards && (
          <section className="mt-4 flex items-end justify-between rounded-2xl border border-brass-soft/40 bg-card/80 p-3">
            <div className="flex gap-2">
              {data.myCards.map((c) => (
                <PlayingCard key={c} card={c} size="lg" />
              ))}
            </div>
            <div className="text-right">
              <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                Tu mano
              </p>
              <p className="font-display text-xl text-primary">{myBest?.name ?? "Omaha"}</p>
            </div>
          </section>
        )}

        {/* Acciones */}
        <section className="mt-4 space-y-3">
          {legal && !hand?.complete ? (
            <ActionBar
              legal={legal}
              disabled={busy}
              onAction={(action, amount) =>
                void run(() => sendAction({ data: { code: codigo, action, amount } }))
              }
            />
          ) : hand && !hand.complete && amSeated ? (
            <p className="rounded-xl border border-border/60 bg-card/70 py-4 text-center text-sm text-muted-foreground">
              Esperando a{" "}
              <span className="text-foreground">
                {seats.find((s) => s.seat === hand.currentSeat)?.name ?? "los demás"}
              </span>
              …
            </p>
          ) : null}

          {hand?.complete && (
            <div className="rounded-xl border border-brass-soft/50 bg-card/80 p-3 text-center">
              <p className="font-display text-xl text-primary">
                {hand.winners.map((w) => `${w.name} +${w.amount.toLocaleString("es-MX")}`).join(" · ")}
              </p>
              {hand.winners[0]?.handName && (
                <p className="text-xs text-muted-foreground">con {hand.winners[0].handName}</p>
              )}
            </div>
          )}

          {!amSeated && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => join({ data: { code: codigo } }))}
              className="w-full rounded-xl bg-primary py-3 font-display text-lg tracking-wide text-primary-foreground disabled:opacity-50"
            >
              Sentarme en la mesa
            </button>
          )}

          {canDeal && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => deal({ data: { code: codigo } }))}
              className="w-full rounded-xl bg-primary py-3 font-display text-lg tracking-wide text-primary-foreground disabled:opacity-50"
            >
              {hand ? "Repartir siguiente mano" : "Repartir primera mano"}
            </button>
          )}

          {!data.me.isHost && (!hand || hand.complete) && amSeated && (
            <p className="text-center text-xs text-muted-foreground">
              El anfitrión reparte la siguiente mano.
            </p>
          )}
        </section>

        {/* Historial */}
        {hand?.log?.length ? (
          <section className="mt-5 rounded-2xl border border-border/50 bg-card/50 p-3">
            <h2 className="text-sm text-muted-foreground">Historial de la mano</h2>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {hand.log.slice(-8).map((line, i) => (
                <li key={`${i}-${line}`}>{line}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <footer className="mt-auto pt-6 text-center">
          {amSeated && (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                await run(() => leave({ data: { code: codigo } }));
                navigate({ to: "/" });
              }}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              Levantarme de la mesa
            </button>
          )}
        </footer>
      </div>
    </main>
  );
}

export type { PublicHandState };
