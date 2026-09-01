import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  addPlayerToTable,
  getHostPanel,
  getHouseStats,
  setPlayerChips,
} from "@/lib/poker/table.functions";

export const Route = createFileRoute("/_authenticated/panel")({
  head: () => ({
    meta: [
      { title: "Panel del anfitrión — Killing Ases Poker Club" },
      {
        name: "description",
        content:
          "Panel del anfitrión: revisa a todos los jugadores del club, sus fichas por mesa y entrega o retira fichas desde un solo lugar.",
      },
      { property: "og:title", content: "Panel del anfitrión — Killing Ases Poker Club" },
      {
        property: "og:description",
        content: "Lista global de jugadores, fichas por mesa y control del banco del club.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error }) => (
    <main className="felt-surface min-h-screen p-6 text-foreground">
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : "No pudimos cargar el panel"}
      </p>
      <Link to="/" className="mt-4 inline-block text-sm text-primary underline">
        Volver al inicio
      </Link>
    </main>
  ),
  notFoundComponent: () => (
    <main className="felt-surface min-h-screen p-6 text-foreground">Panel no encontrado</main>
  ),
  component: HostPanel,
});

function HostPanel() {
  const panel = useServerFn(getHostPanel);
  const adjust = useServerFn(setPlayerChips);
  const addToTable = useServerFn(addPlayerToTable);
  const [busy, setBusy] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [targetTable, setTargetTable] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");

  const query = useQuery({
    queryKey: ["host-panel"],
    queryFn: () => panel({}),
    refetchInterval: 5000,
  });

  const data = query.data;
  const tables = data?.tables ?? [];

  useEffect(() => {
    if (tables.length === 0) return;
    setTargetTable((prev) => {
      const next = { ...prev };
      for (const p of data?.players ?? []) {
        if (!next[p.userId]) next[p.userId] = tables[0]!.code;
      }
      return next;
    });
  }, [data?.players, tables]);

  const amountFor = (key: string, fallback: number) => {
    const raw = Number(amounts[key] ?? "");
    return Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : fallback;
  };

  const run = useCallback(
    async (fn: () => Promise<unknown>, ok: string) => {
      setBusy(true);
      try {
        await fn();
        toast.success(ok);
        await query.refetch();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo aplicar el cambio");
      } finally {
        setBusy(false);
      }
    },
    [query],
  );

  const players = (data?.players ?? []).filter((p) =>
    p.displayName.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <main className="felt-surface min-h-screen">
      <div className="mx-auto w-full max-w-2xl px-5 py-8">
        <header className="flex items-center justify-between">
          <Link to="/" className="font-display text-xl tracking-widest text-primary">
            Killing Ases Poker Club
          </Link>
          <span className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
            Panel del anfitrión
          </span>
        </header>

        <h1 className="mt-6 text-3xl text-foreground">Jugadores del club</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cada jugador tiene un banco global del club. Aquí le agregas o retiras fichas de ese
          banco; después él decide con cuánto entra a la mesa que quiera.
        </p>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar jugador…"
          className="mt-4 w-full rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground outline-none focus:border-brass"
        />

        {query.isLoading && <p className="mt-6 text-sm text-muted-foreground">Cargando…</p>}

        <ul className="mt-6 space-y-3">
          {players.map((p) => {
            const target = targetTable[p.userId] ?? tables[0]?.code ?? "";
            const key = p.userId;
            const membership = p.memberships.find((m) => m.code === target);
            return (
              <li
                key={p.userId}
                className="rounded-2xl border border-brass-soft/40 bg-card/85 p-3"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-base font-semibold text-foreground">
                    {p.displayName}
                  </p>
                  <span className="tabular text-xs text-muted-foreground">
                    Banco{" "}
                    <span className="font-display text-base text-primary">
                      {p.bankChips.toLocaleString("es-MX")}
                    </span>
                  </span>
                </div>

                {p.memberships.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {p.memberships.map((m) => (
                      <li key={m.code} className="tabular text-xs text-muted-foreground">
                        <span className="text-primary">{m.code}</span> ·{" "}
                        {m.chips.toLocaleString("es-MX")} fichas en juego ·{" "}
                        {m.seat === null ? "espectador" : `asiento ${m.seat + 1}`}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    placeholder="1000"
                    value={amounts[key] ?? ""}
                    onChange={(e) => setAmounts((prev) => ({ ...prev, [key]: e.target.value }))}
                    aria-label={`Fichas para el banco de ${p.displayName}`}
                    className="tabular w-24 rounded-lg border border-input bg-background px-2 py-2 text-sm text-foreground outline-none focus:border-brass"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () =>
                          adjust({
                            data: { userId: p.userId, delta: amountFor(key, 1000) },
                          }),
                        "Fichas agregadas al banco",
                      )
                    }
                    className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    Dar al banco
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () =>
                          adjust({
                            data: { userId: p.userId, delta: -amountFor(key, 1000) },
                          }),
                        "Fichas retiradas del banco",
                      )
                    }
                    className="rounded-lg border border-border px-3 py-2 text-sm text-foreground disabled:opacity-50"
                  >
                    Quitar
                  </button>
                </div>

                {tables.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <select
                      value={target}
                      onChange={(e) =>
                        setTargetTable((prev) => ({ ...prev, [p.userId]: e.target.value }))
                      }
                      className="rounded-lg border border-input bg-background px-2 py-2 text-sm text-foreground outline-none focus:border-brass"
                    >
                      {tables.map((t) => (
                        <option key={t.code} value={t.code}>
                          {t.code} · {t.name}
                        </option>
                      ))}
                    </select>

                    {!membership && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          run(
                            () => addToTable({ data: { code: target, userId: p.userId } }),
                            "Jugador invitado a la mesa",
                          )
                        }
                        className="rounded-lg border border-brass px-3 py-2 text-sm text-primary disabled:opacity-50"
                      >
                        Invitar a la mesa
                      </button>
                    )}

                    <Link
                      to="/mesa/$codigo"
                      params={{ codigo: target }}
                      className="text-sm text-primary underline-offset-4 hover:underline"
                    >
                      Ir a la mesa
                    </Link>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

      </div>
    </main>
  );
}
