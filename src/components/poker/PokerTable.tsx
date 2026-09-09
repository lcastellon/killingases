import { PlayingCard } from "@/components/poker/PlayingCard";
import { ChipStack } from "@/components/poker/ChipStack";
import { SeatPill } from "@/components/poker/SeatPill";
import { EmptySeat } from "@/components/poker/EmptySeat";
import type { SeatView } from "@/components/poker/Seat";
import type { CSSProperties } from "react";

/** Positions (in % of the oval container) for 8 seats, starting at the bottom. */
const RING: Array<{ x: number; y: number }> = [
  { x: 50, y: 100 },
  { x: 10, y: 86 },
  { x: 0, y: 45 },
  { x: 16, y: 4 },
  { x: 50, y: 0 },
  { x: 84, y: 4 },
  { x: 100, y: 45 },
  { x: 90, y: 86 },
];

export function PokerTable({
  seats,
  pot,
  board,
  handNo,
  handComplete = false,
  maxSeats = 8,
  onAvatarClick,
  onEmptySeatClick,
}: {
  seats: SeatView[];
  pot: number;
  board: string[];
  handNo?: number | undefined;
  handComplete?: boolean | undefined;
  maxSeats?: number;
  onAvatarClick?: (() => void) | undefined;
  onEmptySeatClick?: ((seat: number) => void) | undefined;
}) {
  const slots = Math.min(Math.max(maxSeats, 2), RING.length);

  // Cada silla corresponde al número de asiento real (0..slots-1).
  const filled: Array<{ seatNo: number; view: SeatView | null }> = Array.from(
    { length: slots },
    (_, i) => ({ seatNo: i, view: null }),
  );
  const overflow: SeatView[] = [];
  [...seats]
    .sort((a, b) => a.seat - b.seat)
    .forEach((view) => {
      const preferred = ((view.seat % slots) + slots) % slots;
      if (filled[preferred]!.view === null) filled[preferred]!.view = view;
      else overflow.push(view);
    });
  overflow.forEach((view) => {
    const slot = filled.find((s) => s.view === null);
    if (slot) slot.view = view;
  });

  // Rota para que el jugador local quede abajo.
  const meIndex = filled.findIndex((s) => s.view?.isMe);
  const ordered = meIndex > 0 ? [...filled.slice(meIndex), ...filled.slice(0, meIndex)] : filled;
  const activeSeats = ordered.flatMap((slot) => (slot.view ? [slot.view.seat] : []));

  return (
    <div className="relative mx-auto w-full max-w-3xl px-9 py-12 sm:px-24 sm:py-20">
      {/* Riel y fieltro */}
      <div className="poker-table-stage relative aspect-[16/9] w-full rounded-[50%] border-[6px] sm:border-[10px] border-felt-deep bg-[radial-gradient(circle_at_50%_35%,var(--felt)_0%,var(--felt-deep)_85%)] shadow-table ring-2 ring-brass-soft/40">
        <div className="absolute inset-3 rounded-[50%] border border-felt-line/40" />

        {/* Centro: bote y cartas comunitarias */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-3 sm:gap-2 sm:px-6">
          <div className="flex flex-col items-center">
            {pot > 0 && (
              <ChipStack
                key={`${handNo ?? 0}-${pot}`}
                amount={pot}
                className="pot-chips-pop mb-0.5"
              />
            )}
            <span className="tabular font-display text-lg leading-none text-primary sm:text-2xl">
              {pot.toLocaleString("es-MX")}
            </span>
            <span className="text-[0.6rem] uppercase tracking-widest text-muted-foreground">
              Bote
            </span>
          </div>
          <div className="flex gap-1 sm:gap-1.5">
            {Array.from({ length: 5 }).map((_, i) => {
              const card = board[i];
              return card ? (
                <PlayingCard
                  key={`${handNo ?? 0}-${i}-${card}`}
                  card={card}
                  size="md"
                  className="board-card-reveal"
                  style={{ "--board-delay": `${i * 80}ms` } as CSSProperties}
                />
              ) : (
                <div
                  key={i}
                  className="h-12 w-8 rounded border border-dashed border-felt-line/40 sm:h-16 sm:w-11 sm:rounded-md"
                />
              );
            })}
          </div>
        </div>

        {/* Asientos alrededor del óvalo */}
        {ordered.map((slot, i) => {
          const pos = RING[i]!;
          return (
            <div
              key={slot.view ? `p-${slot.view.seat}` : `empty-${slot.seatNo}`}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={
                {
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  "--deal-from-x": `${50 - pos.x}cqw`,
                  "--deal-from-y": `${(50 - pos.y) * 0.5625}cqw`,
                } as CSSProperties
              }
            >
              {slot.view ? (
                <SeatPill
                  view={slot.view}
                  onAvatarClick={onAvatarClick}
                  cardsBelow={i === 0}
                  deal={
                    handNo && !handComplete
                      ? {
                          handNo,
                          playerOrder: activeSeats.indexOf(slot.view.seat),
                          playerCount: activeSeats.length,
                        }
                      : undefined
                  }
                />
              ) : (
                <EmptySeat
                  onClick={onEmptySeatClick ? () => onEmptySeatClick(slot.seatNo) : undefined}
                />
              )}
            </div>
          );
        })}

        {/* Al terminar la mano, el bote viaja del centro hacia cada ganador. */}
        {handComplete &&
          ordered.map((slot, i) => {
            if (!slot.view?.winAmount) return null;
            const pos = RING[i]!;
            return (
              <ChipStack
                key={`award-${handNo ?? 0}-${slot.view.seat}-${slot.view.winAmount}`}
                amount={slot.view.winAmount}
                className="pot-to-winner pointer-events-none absolute left-1/2 top-1/2 z-20"
                style={
                  {
                    "--winner-x": `${pos.x - 50}cqw`,
                    "--winner-y": `${(pos.y - 50) * 0.5625}cqw`,
                  } as CSSProperties
                }
              />
            );
          })}
      </div>
    </div>
  );
}
