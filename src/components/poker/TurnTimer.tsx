import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Countdown for the current turn. The server owns the real deadline. */
export function TurnTimer({
  endsAt,
  totalSeconds,
  label,
  onExpire,
}: {
  endsAt: string;
  totalSeconds: number;
  label: string;
  onExpire?: () => void;
}) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, (Date.parse(endsAt) - Date.now()) / 1000),
  );

  useEffect(() => {
    let fired = false;
    const tick = () => {
      const next = Math.max(0, (Date.parse(endsAt) - Date.now()) / 1000);
      setRemaining(next);
      if (next === 0 && !fired) {
        fired = true;
        onExpire?.();
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [endsAt, onExpire]);

  const ratio = totalSeconds > 0 ? Math.min(1, remaining / totalSeconds) : 0;
  const urgent = remaining <= 5;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span
          className={cn(
            "tabular font-display text-base",
            urgent ? "text-destructive" : "text-primary",
          )}
        >
          {Math.ceil(remaining)}s
        </span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-label="Tiempo restante del turno"
        aria-valuenow={Math.ceil(remaining)}
        aria-valuemin={0}
        aria-valuemax={totalSeconds}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-200 ease-linear",
            urgent ? "bg-destructive" : "bg-primary",
          )}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}
