import { cardLabel, isRed, SUIT_SYMBOL, suitOf } from "@/lib/poker/cards";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, string> = {
  sm: "h-8 w-6 text-[0.6rem] rounded-[0.25rem] sm:h-11 sm:w-8 sm:text-[0.7rem] sm:rounded-[0.3rem]",
  md: "h-12 w-8 text-xs rounded sm:h-16 sm:w-11 sm:text-sm sm:rounded-md",
  lg: "h-20 w-14 text-base rounded-md sm:h-24 sm:w-[4.25rem] sm:text-lg sm:rounded-lg",
};

export function PlayingCard({
  card,
  size = "md",
  className,
  dimmed,
}: {
  card?: string | null | undefined;
  size?: Size | undefined;
  className?: string | undefined;
  dimmed?: boolean | undefined;
}) {
  if (!card) {
    return (
      <div
        aria-hidden
        className={cn(
          "flex items-center justify-center border border-brass-soft/40 bg-card-back shadow-chip",
          SIZES[size],
          className,
        )}
      >
        <span className="font-display text-brass-soft/70">MA</span>
      </div>
    );
  }

  const red = isRed(card);
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center border border-border/40 bg-card-face shadow-chip",
        SIZES[size],
        dimmed && "opacity-45",
        className,
      )}
    >
      <span
        className={cn(
          "font-display leading-none",
          size === "lg"
            ? "text-xl sm:text-2xl"
            : size === "md"
              ? "text-base sm:text-lg"
              : "text-xs sm:text-base",
          red ? "text-card-ink-red" : "text-card-ink",
        )}
      >
        {cardLabel(card)}
      </span>
      <span className={cn("leading-none", red ? "text-card-ink-red" : "text-card-ink")}>
        {SUIT_SYMBOL[suitOf(card)]}
      </span>
    </div>
  );
}
