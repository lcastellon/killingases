import { cardLabel, isRed, SUIT_SYMBOL, suitOf } from "@/lib/poker/cards";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, string> = {
  sm: "h-11 w-8 text-[0.7rem] rounded-[0.3rem]",
  md: "h-16 w-11 text-sm rounded-md",
  lg: "h-24 w-[4.25rem] text-lg rounded-lg",
};

export function PlayingCard({
  card,
  size = "md",
  className,
  dimmed,
}: {
  card?: string | null;
  size?: Size;
  className?: string;
  dimmed?: boolean;
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
          size === "lg" ? "text-2xl" : size === "md" ? "text-lg" : "text-base",
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
