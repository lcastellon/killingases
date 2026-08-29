import { PlayingCard } from "@/components/poker/PlayingCard";
import { SeatPill } from "@/components/poker/SeatPill";
import { EmptySeat } from "@/components/poker/EmptySeat";
import type { SeatView } from "@/components/poker/Seat";

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
  maxSeats = 8,
  onAvatarClick,
  onEmptySeatClick,
}: {
  seats: SeatView[];
  pot: number;
  board: string[];
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
  const ordered =
    meIndex > 0 ? [...filled.slice(meIndex), ...filled.slice(0, meIndex)] : filled;

  return (
    <div className="relative mx-auto w-full max-w-3xl px-9 py-12 sm:px-24 sm:py-20">
      {/* Riel y fieltro */}
      <div className="relative aspect-[16/9] w-full rounded-[50%] border-[6px] sm:border-[10px] border-felt-deep bg-[radial-gradient(circle_at_50%_35%,var(--felt)_0%,var(--felt-deep)_85%)] shadow-table ring-2 ring-brass-soft/40">
        <div className="absolute inset-3 rounded-[50%] border border-felt-line/40" />

        {/* Centro: bote y cartas comunitarias */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-3 sm:gap-2 sm:px-6">
          <div className="flex flex-col items-center">
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
                <PlayingCard key={i} card={card} size="md" />
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
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              {slot.view ? (
                <SeatPill view={slot.view} onAvatarClick={onAvatarClick} cardsBelow={i === 0} />
              ) : (
                <EmptySeat
                  onClick={
                    onEmptySeatClick ? () => onEmptySeatClick(slot.seatNo) : undefined
                  }
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

