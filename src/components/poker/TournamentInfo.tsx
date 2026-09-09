import { useEffect, useMemo, useState } from "react";
import type { TournamentView } from "@/lib/poker/tournament";
import { ordinalPlace } from "@/lib/poker/tournament";

const STATUS_LABEL = {
  registering: "Inscripción abierta",
  running: "En juego",
  completed: "Finalizado",
  cancelled: "Cancelado",
} as const;

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

export function TournamentInfo({
  tournament,
  bankChips,
  isHost,
  busy,
  onRegister,
  onUnregister,
  onStart,
  onRebuy,
  onDeclineRebuy,
}: {
  tournament: TournamentView;
  bankChips: number;
  isHost: boolean;
  busy: boolean;
  onRegister: () => void;
  onUnregister: () => void;
  onStart: () => void;
  onRebuy: () => void;
  onDeclineRebuy: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const resultKey = tournament.me
    ? `${tournament.me.status}:${tournament.me.finishPosition}:${tournament.me.prizeAmount}`
    : "";
  const [dismissedResult, setDismissedResult] = useState<string | null>(null);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const nextLevelSeconds = tournament.nextLevelAt
    ? Math.ceil((Date.parse(tournament.nextLevelAt) - now) / 1000)
    : null;
  const eliminated = tournament.me?.status === "eliminated";
  const winner = tournament.me?.status === "winner";
  const showResult = (eliminated || winner) && dismissedResult !== resultKey;
  const canStart =
    tournament.status === "registering" &&
    tournament.entriesCount >=
      (tournament.format === "sit_go" ? tournament.maxPlayers : tournament.minPlayers);
  const prizeRows = useMemo(
    () =>
      tournament.prizeStructure.map((prize) => ({
        ...prize,
        amount: Math.floor((tournament.prizePool * prize.percent) / 100),
      })),
    [tournament.prizePool, tournament.prizeStructure],
  );
  const projectedPrize = tournament.me?.finishPosition
    ? (prizeRows.find((prize) => prize.place === tournament.me?.finishPosition)?.amount ?? 0)
    : 0;

  return (
    <>
      <section className="mt-2 rounded-2xl border border-primary/45 bg-card/85 p-3 sm:mt-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.2em] text-primary">
              {tournament.format === "sit_go" ? "Sit & Go" : "Torneo programado"}
            </p>
            <h2 className="font-display text-xl text-foreground">
              {STATUS_LABEL[tournament.status]}
            </h2>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p>
              <span className="font-display text-lg text-primary">
                {tournament.status === "registering"
                  ? tournament.entriesCount
                  : tournament.remainingPlayers}
              </span>{" "}
              jugadores restantes
            </p>
            <p>
              {tournament.entriesCount}/{tournament.maxPlayers} inscritos
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <Stat label="Buy-in" value={tournament.buyIn.toLocaleString("es-MX")} />
          <Stat label="Premios" value={tournament.prizePool.toLocaleString("es-MX")} />
          <Stat
            label={`Nivel ${tournament.currentLevel}`}
            value={`${tournament.currentBlinds.smallBlind}/${tournament.currentBlinds.bigBlind}`}
          />
          <Stat
            label="Próximo nivel"
            value={nextLevelSeconds === null ? "—" : formatTime(nextLevelSeconds)}
          />
        </div>

        {tournament.status === "registering" && (
          <div className="mt-3 rounded-xl border border-border/60 bg-background/50 p-3 text-xs text-muted-foreground">
            <p>
              Puntos iniciales: {tournament.startingStack.toLocaleString("es-MX")} · Casa:{" "}
              {tournament.houseFeePercent}% ·{" "}
              {tournament.allowRebuys
                ? `hasta ${tournament.maxRebuys} rebuy(s), nivel ${tournament.rebuyUntilLevel}`
                : "Freezeout"}
            </p>
            {tournament.registrationOpensAt && (
              <p className="mt-1">
                Inscripción: {new Date(tournament.registrationOpensAt).toLocaleString("es-MX")} –{" "}
                {new Date(tournament.registrationClosesAt!).toLocaleString("es-MX")}
              </p>
            )}
          </div>
        )}

        <details className="mt-3 rounded-xl border border-border/60 bg-background/40 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-primary">
            Premios y jugadores
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                Premios
              </p>
              <ul className="mt-1 space-y-1 text-xs text-foreground">
                {prizeRows.map((prize) => (
                  <li key={prize.place} className="flex justify-between">
                    <span>{ordinalPlace(prize.place)}</span>
                    <span>
                      {prize.percent}% · {prize.amount.toLocaleString("es-MX")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                Jugadores
              </p>
              <ul className="mt-1 space-y-1 text-xs text-foreground">
                {tournament.entries.map((entry) => (
                  <li key={entry.userId} className="flex justify-between gap-2">
                    <span className="truncate">
                      Asiento {entry.seat + 1} · {entry.displayName}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {entry.status === "winner"
                        ? "Ganador"
                        : entry.finishPosition
                          ? ordinalPlace(entry.finishPosition)
                          : entry.status === "registered"
                            ? "Inscrito"
                            : "En juego"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </details>

        {tournament.status === "registering" && (
          <div className="mt-3 space-y-2">
            {!tournament.me ? (
              <button
                type="button"
                disabled={busy || !tournament.registrationIsOpen || bankChips < tournament.buyIn}
                onClick={onRegister}
                className="w-full rounded-xl bg-primary py-2.5 font-display tracking-wide text-primary-foreground disabled:opacity-50"
              >
                Inscribirme · {tournament.buyIn.toLocaleString("es-MX")}
              </button>
            ) : tournament.me.status === "registered" ? (
              <button
                type="button"
                disabled={busy}
                onClick={onUnregister}
                className="w-full rounded-xl border border-border/70 py-2 text-sm text-muted-foreground disabled:opacity-50"
              >
                Cancelar inscripción y reembolsar buy-in
              </button>
            ) : null}
            {!tournament.registrationIsOpen && !tournament.me && (
              <p className="text-center text-xs text-muted-foreground">
                La inscripción no está disponible en este momento.
              </p>
            )}
            {bankChips < tournament.buyIn && !tournament.me && (
              <p className="text-center text-xs text-chip-red">
                Tu banco no alcanza para este buy-in.
              </p>
            )}
            {isHost && (
              <button
                type="button"
                disabled={busy || !canStart}
                onClick={onStart}
                className="w-full rounded-xl border border-brass py-2 font-display tracking-wide text-primary disabled:opacity-50"
              >
                {tournament.format === "sit_go" && !canStart
                  ? `Inicia automáticamente al llegar a ${tournament.maxPlayers}`
                  : canStart
                    ? "Cerrar inscripción e iniciar"
                    : `Faltan ${Math.max(0, tournament.minPlayers - tournament.entriesCount)} jugador(es)`}
              </button>
            )}
          </div>
        )}
      </section>

      {tournament.me?.status === "rebuy_pending" && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-chip-red/60 bg-card p-5 text-center shadow-table">
            <p className="text-xs uppercase tracking-[0.2em] text-chip-red">
              Te quedaste sin puntos
            </p>
            <h2 className="mt-2 font-display text-3xl text-foreground">
              {ordinalPlace(tournament.me.finishPosition ?? tournament.remainingPlayers + 1)} lugar
              provisional
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Puedes volver con {tournament.startingStack.toLocaleString("es-MX")} puntos por{" "}
              {tournament.buyIn.toLocaleString("es-MX")} del banco.
            </p>
            <button
              type="button"
              disabled={busy || bankChips < tournament.buyIn}
              onClick={onRebuy}
              className="mt-4 w-full rounded-xl bg-primary py-3 font-display text-primary-foreground disabled:opacity-50"
            >
              Hacer rebuy
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onDeclineRebuy}
              className="mt-2 w-full rounded-xl border border-border/70 py-2 text-sm text-muted-foreground disabled:opacity-50"
            >
              Terminar mi torneo
            </button>
          </div>
        </div>
      )}

      {showResult && tournament.me && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-primary/60 bg-card p-5 text-center shadow-table">
            <p className="text-xs uppercase tracking-[0.2em] text-primary">
              Torneo finalizado para ti
            </p>
            <h2 className="mt-2 font-display text-4xl text-foreground">
              {ordinalPlace(tournament.me.finishPosition ?? 1)} lugar
            </h2>
            {tournament.me.prizeAmount > 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Ganaste{" "}
                <span className="font-display text-2xl text-primary">
                  {tournament.me.prizeAmount.toLocaleString("es-MX")}
                </span>
                . El premio ya fue sumado a tu banco.
              </p>
            ) : projectedPrize > 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Aseguraste un premio estimado de{" "}
                <span className="font-display text-2xl text-primary">
                  {projectedPrize.toLocaleString("es-MX")}
                </span>
                . Se acreditará automáticamente cuando termine el torneo.
              </p>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Gracias por jugar. Esta vez quedaste fuera de premios.
              </p>
            )}
            <button
              type="button"
              onClick={() => setDismissedResult(resultKey)}
              className="mt-5 w-full rounded-xl bg-primary py-3 font-display text-primary-foreground"
            >
              Ver mesa
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/50 px-2 py-1.5">
      <p className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="tabular font-display text-base text-foreground">{value}</p>
    </div>
  );
}
