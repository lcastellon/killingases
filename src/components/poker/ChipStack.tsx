import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

const TONES = ["red", "blue", "green", "purple", "black"] as const;

function toneIndex(amount: number) {
  if (amount >= 5_000) return 4;
  if (amount >= 1_000) return 3;
  if (amount >= 500) return 2;
  if (amount >= 100) return 1;
  return 0;
}

/** Decorative casino chips; the numeric amount remains the accessible label. */
export function ChipStack({
  amount,
  className,
  style,
}: {
  amount: number;
  className?: string | undefined;
  style?: CSSProperties | undefined;
}) {
  const base = toneIndex(amount);

  return (
    <span aria-hidden className={cn("chip-stack", className)} style={style}>
      {Array.from({ length: 3 }).map((_, index) => {
        const tone = TONES[(base + index) % TONES.length]!;
        return (
          <span
            key={tone}
            className={cn("casino-chip", `casino-chip--${tone}`)}
            style={{ top: `${(2 - index) * 2}px`, zIndex: index + 1 }}
          />
        );
      })}
    </span>
  );
}
