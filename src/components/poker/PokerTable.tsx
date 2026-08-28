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
}: {
  seats: SeatView[];
  pot: number;
  board: string[];
  maxSeats?: number;
}) {
  const slots = Math.min(Math.max(maxSeats, 2), RING.length);

  // Coloca a cada jugador en una silla y deja el resto vacías.
  const filled: Array<SeatView | null> = Array.from({ length: slots }, () => null);
  const sorted = [...seats].sort((a, b) => a.seat - b.seat);
  sorted.forEach((view, i) => {
    const preferred = ((view.seat % slots) + slots) % slots;
    let idx = filled[preferred] === null ? preferred : -1;
    if (idx === -1) {
      for (let k = 0; k < slots; k++) {
        const candidate = (i + k) % slots;
        if (filled[candidate] === null) {
          idx = candidate;
          break;
        }
      }
    }
    if (idx !== -1) filled[idx] = view;
  });

  // Rota para que el jugador local quede abajo.
  const meIndex = filled.findIndex((v) => v?.isMe);
  const ordered =
    meIndex > 0 ? [...filled.slice(meIndex), ...filled.slice(0, meIndex)] : filled;

  return (
    <div className="relative mx-auto w-full max-w-3xl px-16 py-16 sm:px-24 sm:py-20">
      {/* Riel y fieltro */}
      <div className="relative aspect-[16/9] w-full rounded-[50%] border-[10px] border-felt-deep bg-[radial-gradient(circle_at_50%_35%,var(--felt)_0%,var(--felt-deep)_85%)] shadow-table ring-2 ring-brass-soft/40">
        <div className="absolute inset-3 rounded-[50%] border border-felt-line/40" />

        {/* Centro: bote y cartas comunitarias */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6">
          <div className="flex gap-1.5">
            {Array.from({ length: 5 }).map((_, i) => {
              const card = board[i];
              return card ? (
                <PlayingCard key={i} card={card} size="md" />
              ) : (
                <div
                  key={i}
                  className="h-16 w-11 rounded-md border border-dashed border-felt-line/40"
                />
              );
            })}
          </div>
          <div className="flex flex-col items-center">
            <span className="tabular font-display text-2xl leading-none text-primary">
              {pot.toLocaleString("es-MX")}
            </span>
            <span className="text-[0.6rem] uppercase tracking-widest text-muted-foreground">
              Bote
            </span>
          </div>
        </div>

        {/* Asientos alrededor del óvalo */}
        {ordered.map((view, i) => {
          const pos = RING[i]!;
          return (
            <div
              key={view ? `p-${view.seat}` : `empty-${i}`}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              {view ? <SeatPill view={view} /> : <EmptySeat />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
