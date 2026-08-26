import { PlayingCard } from "./PlayingCard";
import type { ShowdownEntry } from "@/lib/poker/engine";
import { cn } from "@/lib/utils";

/** Detailed showdown: best hand, exact 2+3 cards used and a short explanation. */
export function Showdown({ entries }: { entries: ShowdownEntry[] }) {
  if (!entries.length) return null;
  return (
    <section className="space-y-2 rounded-2xl border border-brass-soft/40 bg-card/80 p-3">
      <h2 className="text-[0.7rem] uppercase tracking-widest text-muted-foreground">
        Showdown · Omaha usa exactamente 2 cartas propias + 3 de la mesa
      </h2>
      <ul className="space-y-2">
        {entries.map((entry) => (
          <li
            key={entry.seat}
            className={cn(
              "rounded-xl border px-3 py-2",
              entry.amount > 0 ? "border-brass bg-felt-deep/50" : "border-border/50 bg-card/60",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold">{entry.name}</span>
              <span className="font-display text-base text-primary">
                {entry.handName}
                {entry.amount > 0 ? ` · +${entry.amount.toLocaleString("es-MX")}` : ""}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                {entry.holeUsed.map((c) => (
                  <PlayingCard key={`h-${c}`} card={c} size="sm" />
                ))}
                <span className="ml-1 text-[0.65rem] uppercase text-muted-foreground">Su mano</span>
              </div>
              <span className="text-muted-foreground">+</span>
              <div className="flex items-center gap-1">
                {entry.boardUsed.map((c) => (
                  <PlayingCard key={`b-${c}`} card={c} size="sm" />
                ))}
                <span className="ml-1 text-[0.65rem] uppercase text-muted-foreground">Mesa</span>
              </div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{entry.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
