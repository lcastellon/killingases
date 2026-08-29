import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import {
  act,
  buyInTable,
  dealHand,
  getTableSnapshot,
  leaveTable,
  rebuyTable,
  resetTable,
  type TableSnapshot,
} from "@/lib/poker/table.functions";
import { legalActions, type HandState } from "@/lib/poker/engine";
import { evaluateOmaha } from "@/lib/poker/cards";
import { PlayingCard } from "@/components/poker/PlayingCard";
import { type SeatView } from "@/components/poker/Seat";
import { PokerTable } from "@/components/poker/PokerTable";

import { ActionBar } from "@/components/poker/ActionBar";
import { useTableRealtime } from "@/hooks/useTableRealtime";
import { TurnTimer } from "@/components/poker/TurnTimer";
import { Showdown } from "@/components/poker/Showdown";
import { PlayerSettings } from "@/components/poker/PlayerSettings";
import { applyFeltTheme } from "@/lib/poker/theme";


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
  const queryClient = useQueryClient();
  const snapshot = useServerFn(getTableSnapshot);
  const deal = useServerFn(dealHand);
  const sendAction = useServerFn(act);
  const leave = useServerFn(leaveTable);
  const buy = useServerFn(buyInTable);
  const rebuy = useServerFn(rebuyTable);
  const resetChips = useServerFn(resetTable);
  const [busy, setBusy] = useState(false);
  const [buyin, setBuyin] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [seatTarget, setSeatTarget] = useState<number | null>(null);
  const [finalDismissed, setFinalDismissed] = useState(false);


  const query = useQuery({
    queryKey: ["mesa", codigo],
    queryFn: () => snapshot({ data: { code: codigo } }),
    refetchInterval: 2000,
    // La mesa es estado vivo: cada respuesta debe reemplazar el snapshot previo.
    // Desactivar structural sharing evita conservar ramas antiguas de jugadores
    // cuando otro cliente cambia de espectador a un asiento.
    structuralSharing: false,
    staleTime: 0,
    // La vista previa vive en un iframe que casi nunca tiene el foco: sin esto
    // el sondeo se pausa y la mesa se queda con datos viejos.
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: "always",
  });

  // Estable entre renders: si cambiara, el canal de realtime se resuscribiría siempre.
  const refetch = useCallback(() => {
    void query.refetch();
  }, [query]);

  useTableRealtime(query.data?.table.id, refetch);

  const data = query.data;
  const feltTheme = query.data?.me.feltTheme;
  useEffect(() => {
    applyFeltTheme(feltTheme);
  }, [feltTheme]);
  const hand = data?.hand ?? null;

  const spectators = useMemo(
    () => (data ? data.players.filter((p) => p.seat === null) : []),
    [data],
  );

  const seats: SeatView[] = useMemo(() => {
    if (!data) return [];
    return data.players
      .filter((p): p is (typeof data.players)[number] & { seat: number } => p.seat !== null)
      .slice()
      .sort((a, b) => a.seat - b.seat)
      .map((p) => {
        const handPlayer = hand?.players.find((hp) => hp.seat === p.seat);
        const revealed = hand?.revealed?.[String(p.seat)] ?? null;
        const isMe = p.userId === data.me.userId;
        const cards = isMe ? (data.myCards ?? revealed) : revealed;
        const winner = hand?.winners?.find((w) => w.seat === p.seat);
        const handOver = Boolean(hand?.complete);
        return {
          seat: p.seat,
          name: p.displayName,
          chips: handPlayer?.chips ?? p.chips,
          // Al terminar la mano se limpian apuestas y etiquetas de la ronda.
          bet: handOver ? 0 : (handPlayer?.bet ?? 0),
          folded: handOver ? false : (handPlayer?.folded ?? false),
          allIn: handOver ? false : (handPlayer?.allIn ?? false),
          isTurn: hand?.currentSeat === p.seat,
          isButton: hand ? hand.buttonSeat === p.seat : data.table.buttonSeat === p.seat,
          isMe,
          cards,
          cardCount: handPlayer ? 4 : 0,
          winAmount: winner?.amount,
          handName: winner?.handName,

          online: p.online,
          avatarUrl: p.avatarUrl,
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
  const amAtTable = data.players.some((p) => p.userId === data.me.userId);
  const seatedPlayers = data.players.filter((p) => p.seat !== null);
  const seatedCount = seatedPlayers.length;
  const handOver = !hand || hand.complete;
  const brokePlayers = seatedPlayers.filter((p) => p.chips < data.table.bigBlind);
  const rebuyTarget = Math.min(
    data.table.maxBuyin,
    Math.max(data.table.minBuyin, data.table.startingChips),
  );
  const canDeal = data.me.isHost && handOver && seatedCount >= 2 && brokePlayers.length === 0;
  const withChips = data.players.filter((p) => p.chips >= data.table.bigBlind);
  const gameOver =
    handOver && data.players.length >= 2 && withChips.length <= 1 && (hand?.handNo ?? 0) > 0;
  const overallWinner = withChips[0] ?? null;
  const iAmBroke = data.me.chips < data.table.bigBlind;
  const takenSeats = new Set(seatedPlayers.map((p) => p.seat as number));
  const freeSeats = Array.from({ length: 8 }, (_, i) => i).filter((s) => !takenSeats.has(s));
  const maxBuyinForMe = Math.min(data.table.maxBuyin, data.me.bankChips);
  const canSitDown = !amSeated && freeSeats.length > 0 && maxBuyinForMe >= data.table.minBuyin;
  const openSeatDialog = (seat: number) => {
    setSeatTarget(seat);
    setBuyin(
      String(Math.min(maxBuyinForMe, Math.max(data.table.minBuyin, data.table.startingChips))),
    );
  };




  return (
    <main className="felt-surface min-h-screen pb-4">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-4">
        <header className="flex items-center justify-between gap-3">
          <Link to="/" className="font-display text-xl tracking-widest text-primary">
            Killing Ases Poker Club
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

        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-2 rounded-full border border-brass-soft/50 bg-card px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <span className="grid h-6 w-6 place-items-center overflow-hidden rounded-full border border-brass bg-felt/60 font-display text-[0.6rem] text-primary">
              {data.me.avatarUrl ? (
                <img src={data.me.avatarUrl} alt="Tu avatar" className="h-full w-full object-cover" />
              ) : (
                data.me.displayName.slice(0, 2).toUpperCase()
              )}
            </span>
            Mi perfil
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Ciegas {data.table.smallBlind}/{data.table.bigBlind} · No Limit Omaha
          </span>
          {hand ? (
            <span>{`Mano #${hand.handNo} · ${STREET_LABEL[hand.street]}`}</span>
          ) : (
            <Link
              to="/"
              className="rounded-lg border border-brass-soft/50 bg-card px-2.5 py-1 font-display tracking-wide text-primary transition-colors hover:bg-primary/10"
            >
              Lobby
            </Link>
          )}
        </div>


        {/* Mesa */}
        <PokerTable
          seats={seats}
          pot={hand?.pot ?? 0}
          board={hand?.board ?? []}
          onAvatarClick={() => setSettingsOpen(true)}
          onEmptySeatClick={!amSeated ? (seat) => openSeatDialog(seat) : undefined}
        />

        {/* Sentarse en un asiento libre */}
        {seatTarget !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur">
            <div className="w-full max-w-sm rounded-2xl border border-brass-soft/50 bg-card p-4 shadow-table">
              <h2 className="font-display text-xl tracking-wide text-primary">
                Sentarte en el asiento {seatTarget + 1}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Elige tus fichas entre {data.table.minBuyin.toLocaleString("es-MX")} y{" "}
                {Math.min(data.table.maxBuyin, data.me.bankChips).toLocaleString("es-MX")}. Banco
                del club: {data.me.bankChips.toLocaleString("es-MX")}.
              </p>
              <input
                type="number"
                min={data.table.minBuyin}
                max={Math.min(data.table.maxBuyin, data.me.bankChips)}
                step={data.table.bigBlind}

                inputMode="numeric"
                value={buyin}
                onChange={(e) => setBuyin(e.target.value)}
                aria-label="Fichas con las que te quieres sentar"
                className="tabular mt-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground outline-none focus:border-brass"
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSeatTarget(null)}
                  className="flex-1 rounded-xl border border-border/60 px-4 py-2 text-sm text-muted-foreground"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const maxAllowed = Math.min(data.table.maxBuyin, data.me.bankChips);
                      if (maxAllowed < data.table.minBuyin)
                        throw new Error(
                          `Tu banco tiene ${data.me.bankChips.toLocaleString("es-MX")} fichas; pide fichas al anfitrión`,
                        );
                      const target = Math.min(
                        maxAllowed,
                        Math.max(data.table.minBuyin, Number(buyin) || data.table.minBuyin),
                      );
                      const delta = target - data.me.chips;
                      if (delta <= 0) throw new Error("Elige una cantidad mayor a tus fichas");
                      const result = await buy({
                        data: { code: codigo, amount: delta, seat: seatTarget },
                      });
                      queryClient.setQueryData<TableSnapshot>(["mesa", codigo], (current) => {
                        if (!current) return current;
                        const seatedMe = {
                          userId: current.me.userId,
                          seat: seatTarget,
                          displayName: current.me.displayName,
                          chips: result.chips,
                          sittingOut: false,
                          lastSeenAt: current.serverNow,
                          online: true,
                          avatarUrl: current.me.avatarUrl,
                        };
                        const alreadyListed = current.players.some(
                          (player) => player.userId === current.me.userId,
                        );
                        return {
                          ...current,
                          players: alreadyListed
                            ? current.players.map((player) =>
                                player.userId === current.me.userId
                                  ? { ...player, ...seatedMe }
                                  : player,
                              )
                            : [...current.players, seatedMe],
                          me: {
                            ...current.me,
                            seat: seatTarget,
                            chips: result.chips,
                            bankChips: result.bankChips,
                            isSpectator: false,
                          },
                        };
                      });
                      setSeatTarget(null);
                      setBuyin("");
                      await queryClient.invalidateQueries({ queryKey: ["mesa", codigo] });
                      toast.success(`Te sentaste en el asiento ${seatTarget + 1}`);
                    })

                  }
                  className="flex-1 rounded-xl bg-primary px-4 py-2 font-display tracking-wide text-primary-foreground disabled:opacity-50"
                >
                  Sentarme
                </button>
              </div>
            </div>
          </div>
        )}



        {/* Partida terminada */}
        {gameOver && !finalDismissed && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur">
            <div className="w-full max-w-sm rounded-2xl border border-brass bg-card p-5 text-center shadow-table">
              <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                Partida terminada
              </p>
              <h2 className="mt-1 font-display text-2xl tracking-wide text-primary">
                {overallWinner
                  ? `${overallWinner.displayName} ganó todas las fichas`
                  : "Ya no hay fichas en juego"}
              </h2>
              <div className="mt-4 space-y-2">
                {data.me.isHost && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run(() => resetChips({ data: { code: codigo } }))}
                    className="w-full rounded-xl bg-primary py-3 font-display tracking-wide text-primary-foreground disabled:opacity-50"
                  >
                    Revancha (reiniciar fichas)
                  </button>
                )}
                {amAtTable && iAmBroke && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run(() => rebuy({ data: { code: codigo } }))}
                    className="w-full rounded-xl border border-brass bg-felt-deep/60 py-3 font-display tracking-wide text-primary disabled:opacity-50"
                  >
                    Recargar fichas ({rebuyTarget.toLocaleString("es-MX")})
                  </button>
                )}
                <Link
                  to="/"
                  className="block w-full rounded-xl border border-border/60 py-3 text-sm text-muted-foreground"
                >
                  Volver al inicio
                </Link>
                <button
                  type="button"
                  onClick={() => setFinalDismissed(true)}
                  className="w-full py-1 text-xs text-muted-foreground underline"
                >
                  Seguir viendo la mesa
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mis fichas */}
        {(

          <section className="mt-4 rounded-2xl border border-brass-soft/40 bg-card/80 p-3">
            <div className="flex items-center justify-between gap-3">
              {amSeated ? (
                <div>
                  <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                    Fichas en la mesa
                  </p>
                  <p className="tabular font-display text-3xl text-primary">
                    {data.me.chips.toLocaleString("es-MX")}
                  </p>
                </div>
              ) : (
                <p className="max-w-[12rem] text-xs text-muted-foreground">
                  Todavía no estás sentado: elige tu compra para llevar fichas del banco a la mesa.
                </p>
              )}
              <div className="text-right">
                <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                  Banco del club
                </p>
                <p className="tabular font-display text-2xl text-brass">
                  {data.me.bankChips.toLocaleString("es-MX")}
                </p>
                <p className="text-xs text-muted-foreground">
                  Compra {data.table.minBuyin.toLocaleString("es-MX")}–
                  {data.table.maxBuyin.toLocaleString("es-MX")}
                </p>
              </div>
            </div>


            {!amSeated && (
              <div className="mt-3 border-t border-border/50 pt-3">
                {data.me.bankChips <= 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Tu banco del club está en 0. Pide fichas al anfitrión para poder sentarte.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Toca cualquier asiento libre para elegir con cuántas fichas quieres entrar.
                  </p>
                )}
              </div>
            )}

            {amSeated && handOver && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(() => leave({ data: { code: codigo } }))}
                className="mt-3 w-full rounded-xl border border-border/60 py-2 text-sm text-muted-foreground transition-colors duration-200 hover:border-amber-500/60 hover:bg-amber-500/10 hover:text-amber-400 disabled:opacity-50"
              >
                Levantarme
              </button>
            )}
          </section>
        )}


        {/* Espectadores */}
        {spectators.length > 0 && (
          <section className="mt-3 rounded-2xl border border-border/50 bg-card/50 p-3">
            <h2 className="text-sm text-muted-foreground">Esperando fichas</h2>
            <ul className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {spectators.map((p) => (
                <li key={p.userId} className="rounded-full border border-border/60 px-2 py-0.5">
                  {p.displayName}
                </li>
              ))}
            </ul>
          </section>
        )}




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
          {hand && !hand.complete && hand.turnEndsAt && hand.currentSeat !== null && (
            <TurnTimer
              endsAt={hand.turnEndsAt}
              totalSeconds={hand.turnSeconds ?? data.table.turnSeconds}
              label={
                hand.currentSeat === data.me.seat
                  ? "Tu turno"
                  : `Turno de ${seats.find((s) => s.seat === hand.currentSeat)?.name ?? "otro jugador"}`
              }
              onExpire={refetch}
            />
          )}

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

          {hand?.complete && hand.showdown?.length ? <Showdown entries={hand.showdown} /> : null}

          {hand?.complete && (
            <div className="rounded-xl border border-brass-soft/50 bg-card/80 p-3 text-center">
              <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                Mano terminada
              </p>
              <p className="font-display text-xl text-primary">
                {hand.winners
                  .map((w) => `${w.name} +${w.amount.toLocaleString("es-MX")}`)
                  .join(" · ")}
              </p>
              {hand.winners[0]?.handName && (
                <p className="text-xs text-muted-foreground">con {hand.winners[0].handName}</p>
              )}
            </div>
          )}

          {!amSeated && (
            <div className="space-y-1">
              <button
                type="button"
                disabled={busy || !canSitDown}
                onClick={() => {
                  const seat = freeSeats[0];
                  if (seat === undefined) return;
                  openSeatDialog(seat);
                }}
                className="w-full rounded-xl bg-primary py-3 font-display text-lg tracking-wide text-primary-foreground disabled:opacity-50"
              >
                Sentarme en la mesa
              </button>
              <p className="text-center text-xs text-muted-foreground">
                {freeSeats.length === 0
                  ? "La mesa está llena."
                  : maxBuyinForMe < data.table.minBuyin
                    ? `Necesitas al menos ${data.table.minBuyin.toLocaleString("es-MX")} en tu banco; pide fichas al anfitrión.`
                    : `Elige tu compra entre ${data.table.minBuyin.toLocaleString("es-MX")} y ${maxBuyinForMe.toLocaleString("es-MX")}, o toca un asiento libre.`}
              </p>
            </div>
          )}

          {data.me.isHost && handOver && seatedCount >= 2 && (
            <div className="space-y-2">
              <button
                type="button"
                disabled={busy || !canDeal}
                onClick={() => void run(() => deal({ data: { code: codigo } }))}
                className="w-full rounded-xl bg-primary py-3 font-display text-lg tracking-wide text-primary-foreground disabled:opacity-50"
              >
                {hand ? "Repartir siguiente mano" : "Repartir primera mano"}
              </button>

              {brokePlayers.length > 0 && (
                <div className="rounded-xl border border-chip-red/50 bg-card/70 p-3 text-center">
                  <p className="text-sm text-foreground">
                    {brokePlayers.map((p) => p.displayName).join(", ")}{" "}
                    {brokePlayers.length > 1 ? "no tienen" : "no tiene"} fichas suficientes
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run(() => resetChips({ data: { code: codigo } }))}
                    className="mt-2 w-full rounded-xl border border-brass bg-felt-deep/60 py-2 font-display tracking-wide text-primary disabled:opacity-50"
                  >
                    Recargar fichas a todos ({rebuyTarget.toLocaleString("es-MX")})
                  </button>
                </div>
              )}
            </div>
          )}

          {amSeated && handOver && iAmBroke && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => rebuy({ data: { code: codigo } }))}
              className="w-full rounded-xl border border-brass bg-felt-deep/60 py-3 font-display tracking-wide text-primary disabled:opacity-50"
            >
              Volver con {rebuyTarget.toLocaleString("es-MX")}
            </button>
          )}

          {!data.me.isHost && handOver && amSeated && brokePlayers.length === 0 && (
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
          {amAtTable && (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                await run(() => leave({ data: { code: codigo } }));
                navigate({ to: "/" });
              }}
              className="text-xs text-muted-foreground transition-colors duration-200 hover:text-amber-400"
            >
              Levantarme
            </button>
          )}
        </footer>
      </div>

      <PlayerSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        userId={data.me.userId}
        displayName={data.me.displayName}
        avatarUrl={data.me.avatarUrl}
        feltTheme={data.me.feltTheme}
        onSaved={refetch}
      />
    </main>
  );
}
