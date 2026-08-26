import { useState } from "react";

export type BankPlayer = {
  userId: string;
  displayName: string;
  chips: number;
  seat: number | null;
};

export function ChipBank({
  players,
  minBuyin,
  maxBuyin,
  disabled,
  onAdjust,
}: {
  players: BankPlayer[];
  minBuyin: number;
  maxBuyin: number;
  disabled: boolean;
  onAdjust: (userId: string, delta: number) => void;
}) {
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const amountFor = (userId: string) => {
    const raw = Number(amounts[userId] ?? "");
    return Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : minBuyin;
  };

  return (
    <section className="rounded-2xl border border-brass-soft/50 bg-card/80 p-3">
      <header className="flex items-baseline justify-between">
        <h2 className="font-display text-lg tracking-wide text-primary">Banco de fichas</h2>
        <span className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
          Compra {minBuyin.toLocaleString("es-MX")}–{maxBuyin.toLocaleString("es-MX")}
        </span>
      </header>
      <p className="mt-1 text-xs text-muted-foreground">
        Cada jugador elige su compra inicial dentro del rango. Aquí puedes agregarle o retirarle
        fichas; los cambios se aplican entre manos.
      </p>

      <ul className="mt-3 space-y-2">
        {players.map((p) => (
          <li
            key={p.userId}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-felt-deep/40 p-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{p.displayName}</p>
              <p className="tabular text-xs text-muted-foreground">
                {p.chips.toLocaleString("es-MX")} fichas ·{" "}
                {p.seat === null ? "espectador" : `asiento ${p.seat + 1}`}
              </p>
            </div>
            <input
              type="number"
              min={1}
              inputMode="numeric"
              placeholder={String(minBuyin)}
              value={amounts[p.userId] ?? ""}
              onChange={(e) => setAmounts((prev) => ({ ...prev, [p.userId]: e.target.value }))}
              className="tabular w-24 rounded-lg border border-border/70 bg-background px-2 py-1 text-sm"
              aria-label={`Cantidad de fichas para ${p.displayName}`}
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => onAdjust(p.userId, amountFor(p.userId))}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Dar
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onAdjust(p.userId, -amountFor(p.userId))}
              className="rounded-lg border border-border/70 px-3 py-1.5 text-sm text-muted-foreground disabled:opacity-50 hover:text-destructive"
            >
              Quitar
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
