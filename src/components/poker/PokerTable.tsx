import { PlayingCard } from "@/components/poker/PlayingCard";
import { SeatPill } from "@/components/poker/SeatPill";
import type { SeatView } from "@/components/poker/Seat";

/** Positions (in % of the oval container) for up to 9 seats, starting at the bottom. */
const RING: Array<{ x: number; y: number }> = [
  { x: 50, y: 100 },
  { x: 14, y: 84 },
  { x: 0, y: 50 },
  { x: 14, y: 12 },
  { x: 50, y: 0 },
  { x: 86, y: 12 },
  { x: 100, y: 50 },
  { x: 86, y: 84 },
  { x: 68, y: 100 },
];

export function PokerTable({
  seats,
  pot,
  board,
  maxSeats = 9,
}: {
  seats: SeatView[];
  pot: number;
  board: string[];
  maxSeats?: number;
}) {
  // Rotate so the local player sits at the bottom.
  const meIndex = seats.findIndex((s) => s.isMe);
  const ordered = meIndex > 0 ? [...seats.slice(meIndex), ...seats.slice(0, meIndex)] : seats;
  const slots = Math.min(Math.max(ordered.length, 2), Math.min(maxSeats, RING.length));

  return (
    <div className="relative mx-auto w-full max-w-3xl px-16 py-14 sm:px-20 sm:py-16">
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
        {ordered.slice(0, slots).map((view, i) => {
          const pos = RING[Math.round((i * RING.length) / slots) % RING.length]!;
          return (
            <div
              key={view.seat}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              <SeatPill view={view} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
