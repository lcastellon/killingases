import { PlayingCard } from "./PlayingCard";
import { cn } from "@/lib/utils";
import type { SeatView } from "./Seat";

/** Compact seat plate used around the oval table (StarsWorld-style layout). */
export function SeatPill({ view }: { view: SeatView }) {
  return (
    <div className="flex flex-col items-center gap-1">
      {/* cartas */}
      {view.cardCount > 0 && (
        <div className="flex items-center">
          {Array.from({ length: view.cardCount }).map((_, i) => (
            <PlayingCard
              key={i}
              size="sm"
              card={view.cards?.[i] ?? null}
              dimmed={view.folded}
              className={i > 0 ? "-ml-4" : undefined}
            />
          ))}
        </div>
      )}

      <div
        className={cn(
          "flex items-center gap-2 rounded-full border bg-felt-deep/95 py-1 pl-1 pr-3 shadow-chip backdrop-blur transition-all",
          view.isTurn ? "border-brass shadow-[0_0_0_2px_var(--brass)]" : "border-brass-soft/40",
          view.folded && "opacity-45",
        )}
      >
        <span
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-full border font-display text-sm",
            view.isMe
              ? "border-brass bg-brass/20 text-primary"
              : "border-brass-soft/50 bg-felt/70 text-foreground",
          )}
        >
          {view.name.slice(0, 2).toUpperCase()}
        </span>

        <div className="min-w-0 text-left">
          <div className="flex items-center gap-1">
            <span
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                view.online === false ? "bg-muted-foreground" : "bg-primary",
              )}
              title={view.online === false ? "Sin conexión" : "Conectado"}
            />
            <span className="max-w-[6.5rem] truncate text-xs font-semibold leading-tight">
              {view.name}
            </span>
            {view.isButton && (
              <span className="rounded-full bg-primary px-1 text-[0.55rem] font-bold text-primary-foreground">
                D
              </span>
            )}
          </div>
          <span className="tabular font-display text-base leading-none text-primary">
            {view.chips.toLocaleString("es-MX")}
          </span>
        </div>
      </div>

      <div className="flex min-h-[1rem] flex-col items-center">
        {view.bet > 0 && (
          <span className="tabular rounded-full border border-brass-soft/50 bg-card/90 px-2 text-[0.65rem] text-primary">
            {view.bet.toLocaleString("es-MX")}
          </span>
        )}
        {view.allIn && !view.folded && (
          <span className="text-[0.6rem] font-bold uppercase tracking-wide text-chip-red">
            All-in
          </span>
        )}
        {view.folded && (
          <span className="text-[0.6rem] uppercase text-muted-foreground">Retirado</span>
        )}
        {view.winAmount ? (
          <span className="text-[0.65rem] font-semibold text-primary">
            +{view.winAmount.toLocaleString("es-MX")}
            {view.handName ? ` · ${view.handName}` : ""}
          </span>
        ) : null}
      </div>
    </div>
  );
}
