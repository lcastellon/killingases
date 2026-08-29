import { useEffect, useState } from "react";
import type { LegalActions } from "@/lib/poker/engine";

export function ActionBar({
  legal,
  disabled,
  onAction,
}: {
  legal: LegalActions;
  disabled?: boolean;
  onAction: (action: "fold" | "check" | "call" | "raise", amount?: number) => void;
}) {
  const [raiseTo, setRaiseTo] = useState(legal.minRaiseTo);

  useEffect(() => {
    setRaiseTo(legal.minRaiseTo);
  }, [legal.minRaiseTo, legal.seat, legal.potSize]);

  const clamp = (value: number) =>
    Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, Math.round(value)));

  const shortcuts = [
    { label: "½ bote", value: clamp(legal.potSize / 2 + legal.callAmount) },
    { label: "Bote", value: clamp(legal.potSize + legal.callAmount) },
    { label: "All-in", value: legal.maxRaiseTo },
  ];

  return (
    <div className="space-y-2 rounded-2xl border border-brass-soft/40 bg-card/95 p-2.5 shadow-table backdrop-blur sm:space-y-3 sm:p-3">
      {legal.canRaise && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Subir a</span>
            <span className="tabular font-display text-lg text-primary">
              {raiseTo.toLocaleString("es-MX")}
            </span>
          </div>
          <input
            type="range"
            min={legal.minRaiseTo}
            max={legal.maxRaiseTo}
            step={1}
            value={raiseTo}
            onChange={(e) => setRaiseTo(clamp(Number(e.target.value)))}
            aria-label="Cantidad a subir"
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
          />
          <div className="flex gap-2">
            {shortcuts.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => setRaiseTo(s.value)}
                className="flex-1 rounded-lg border border-border/70 bg-secondary px-2 py-1.5 text-xs font-semibold text-secondary-foreground transition-colors hover:border-brass"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onAction("fold")}
          className="rounded-xl border border-destructive/60 bg-destructive/15 py-3 text-sm font-bold uppercase tracking-wide text-destructive-foreground transition-colors hover:bg-destructive/30 disabled:opacity-50"
        >
          Retirarse
        </button>

        {legal.canCheck ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onAction("check")}
            className="rounded-xl border border-border bg-secondary py-3 text-sm font-bold uppercase tracking-wide text-secondary-foreground transition-colors hover:border-brass disabled:opacity-50"
          >
            Pasar
          </button>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onAction("call")}
            className="rounded-xl border border-border bg-secondary py-3 text-sm font-bold uppercase tracking-wide text-secondary-foreground transition-colors hover:border-brass disabled:opacity-50"
          >
            Igualar
            <span className="tabular ml-1 text-primary">
              {legal.callAmount.toLocaleString("es-MX")}
            </span>
          </button>
        )}

        <button
          type="button"
          disabled={disabled || !legal.canRaise}
          onClick={() => onAction("raise", raiseTo)}
          className="rounded-xl bg-primary py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {legal.callAmount === 0 ? "Apostar" : "Subir"}
        </button>
      </div>
    </div>
  );
}
