import { PlayingCard } from "./PlayingCard";
import { ChipStack } from "./ChipStack";
import { cn } from "@/lib/utils";
import type { SeatView } from "./Seat";
import type { CSSProperties } from "react";

/** Compact seat plate used around the oval table (StarsWorld-style layout). */
export function SeatPill({
  view,
  onAvatarClick,
  cardsBelow,
  deal,
}: {
  view: SeatView;
  onAvatarClick?: (() => void) | undefined;
  cardsBelow?: boolean | undefined;
  deal?: { handNo: number; playerOrder: number; playerCount: number } | undefined;
}) {
  const cardMotion = (cardIndex: number) =>
    deal
      ? {
          className: "card-deal-in",
          style: {
            "--deal-delay": `${(cardIndex * deal.playerCount + deal.playerOrder) * 70}ms`,
            "--deal-rotate": `${deal.playerOrder % 2 === 0 ? -10 : 10}deg`,
          } as CSSProperties,
        }
      : { className: undefined, style: undefined };

  return (
    <div className={cn("flex flex-col items-center gap-1")}>
      {/* cartas: en el asiento local van debajo para no tapar la mesa */}
      {!cardsBelow && view.cardCount > 0 && (
        <div className="flex items-center">
          {Array.from({ length: view.cardCount }).map((_, i) => (
            <PlayingCard
              key={`${deal?.handNo ?? "still"}-${i}`}
              size="sm"
              card={view.cards?.[i] ?? null}
              dimmed={view.folded}
              className={cn(i > 0 && "-ml-3 sm:-ml-4", cardMotion(i).className)}
              style={cardMotion(i).style}
            />
          ))}
        </div>
      )}

      <div
        className={cn(
          "flex items-center gap-1 rounded-full border bg-felt-deep/95 py-0.5 pl-0.5 pr-2 shadow-chip backdrop-blur transition-all sm:gap-2 sm:py-1 sm:pl-1 sm:pr-3",
          view.isTurn ? "border-brass shadow-[0_0_0_2px_var(--brass)]" : "border-brass-soft/40",
          view.folded && "opacity-45",
        )}
      >
        <button
          type="button"
          onClick={view.isMe && onAvatarClick ? onAvatarClick : undefined}
          disabled={!view.isMe || !onAvatarClick}
          title={view.isMe ? "Cambiar tu avatar" : view.name}
          className={cn(
            "grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full border font-display text-[0.65rem] sm:h-9 sm:w-9 sm:text-sm",
            view.isMe
              ? "border-brass bg-brass/20 text-primary hover:brightness-110"
              : "border-brass-soft/50 bg-felt/70 text-foreground",
          )}
        >
          {view.avatarUrl ? (
            <img src={view.avatarUrl} alt={view.name} className="h-full w-full object-cover" />
          ) : (
            view.name.slice(0, 2).toUpperCase()
          )}
        </button>

        <div className="min-w-0 text-left">
          <div className="flex items-center gap-1">
            <span
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                view.online === false ? "bg-muted-foreground" : "bg-primary",
              )}
              title={view.online === false ? "Sin conexión" : "Conectado"}
            />
            <span className="max-w-[4.5rem] truncate text-[0.65rem] font-semibold leading-tight sm:max-w-[6.5rem] sm:text-xs">
              {view.name}
            </span>
            {view.isButton && (
              <span
                title="Botón (dealer)"
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-brass bg-background text-[0.55rem] font-bold text-foreground shadow"
              >
                D
              </span>
            )}
          </div>
          <span className="tabular font-display text-xs leading-none text-primary sm:text-base">
            {view.chips.toLocaleString("es-MX")}
          </span>
        </div>
      </div>

      <div className={cn("flex min-h-[1rem] max-w-[10rem] flex-col items-center text-center")}>
        {view.bet > 0 && (
          <span
            key={`${view.seat}-${view.bet}`}
            className="bet-chips-enter flex items-center gap-1 rounded-full border border-brass-soft/50 bg-card/90 px-1.5 py-0.5"
          >
            <ChipStack amount={view.bet} />
            <span className="tabular text-[0.65rem] text-primary">
              {view.bet.toLocaleString("es-MX")}
            </span>
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
      {cardsBelow && view.cardCount > 0 && (
        <div className="flex items-center gap-1 rounded-xl border border-brass/50 bg-background/55 p-1.5 shadow-chip backdrop-blur-sm">
          {Array.from({ length: view.cardCount }).map((_, i) => (
            <PlayingCard
              key={`${deal?.handNo ?? "still"}-${i}`}
              size="hand"
              card={view.cards?.[i] ?? null}
              dimmed={view.folded}
              className={cn("ring-1 ring-brass-soft/60", cardMotion(i).className)}
              style={cardMotion(i).style}
            />
          ))}
        </div>
      )}
    </div>
  );
}
