import { PlayingCard } from "./PlayingCard";
import { cn } from "@/lib/utils";

export type SeatView = {
  seat: number;
  name: string;
  chips: number;
  bet: number;
  folded: boolean;
  allIn: boolean;
  isTurn: boolean;
  isButton: boolean;
  isMe: boolean;
  cards: string[] | null; // revealed or own cards
  cardCount: number;
  winAmount?: number;
  handName?: string;
};

export function Seat({ view }: { view: SeatView }) {
  return (
    <div
      className={cn(
        "flex w-[8.5rem] flex-col items-center gap-1 rounded-xl border px-2 py-2 text-center transition-all",
        view.isTurn
          ? "border-brass bg-card shadow-[0_0_0_2px_var(--brass)]"
          : "border-border/60 bg-card/85",
        view.folded && "opacity-45",
      )}
    >
      <div className="flex items-center gap-1">
        {view.cardCount > 0 ? (
          Array.from({ length: view.cardCount }).map((_, i) => (
            <PlayingCard
              key={i}
              size="sm"
              card={view.cards?.[i] ?? null}
              dimmed={view.folded}
              className={i > 0 ? "-ml-3" : undefined}
            />
          ))
        ) : (
          <div className="h-11" />
        )}
      </div>

      <div className="flex w-full items-center justify-center gap-1">
        <span className="truncate text-xs font-semibold">{view.name}</span>
        {view.isButton && (
          <span className="rounded-full bg-primary px-1.5 text-[0.6rem] font-bold text-primary-foreground">
            D
          </span>
        )}
      </div>

      <span className="tabular font-display text-lg leading-none text-primary">
        {view.chips.toLocaleString("es-MX")}
      </span>

      {view.allIn && !view.folded && (
        <span className="text-[0.65rem] font-bold uppercase tracking-wide text-chip-red">
          All-in
        </span>
      )}
      {view.folded && <span className="text-[0.65rem] uppercase text-muted-foreground">Retirado</span>}

      {view.bet > 0 && (
        <span className="tabular rounded-full border border-brass-soft/50 bg-felt-deep px-2 py-0.5 text-[0.7rem] text-primary">
          {view.bet.toLocaleString("es-MX")}
        </span>
      )}

      {view.winAmount ? (
        <span className="text-[0.7rem] font-semibold text-primary">
          +{view.winAmount.toLocaleString("es-MX")}
          {view.handName ? ` · ${view.handName}` : ""}
        </span>
      ) : null}
    </div>
  );
}
