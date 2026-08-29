import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  closeTable,
  createTable,
  joinTable,
  listMyTables,
  listOpenTables,
} from "@/lib/poker/table.functions";
import { isHostEmail } from "@/lib/poker/host";
import { PlayingCard } from "@/components/poker/PlayingCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mata Ases — Mesas privadas de Omaha No Limit" },
      {
        name: "description",
        content:
          "Crea una mesa de poker Omaha No Limit, comparte el código con tus amigos y juega en tiempo real desde cualquier dispositivo.",
      },
      { property: "og:title", content: "Mata Ases — Mesas privadas de Omaha No Limit" },
      {
        property: "og:description",
        content: "Crea una mesa, comparte el código y reparte. Poker Omaha con amigos, en vivo.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const create = useServerFn(createTable);
  const join = useServerFn(joinTable);
  const myTables = useServerFn(listMyTables);
  const close = useServerFn(closeTable);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [bigBlind, setBigBlind] = useState(50);
  const [minBuyin, setMinBuyin] = useState(1000);
  const [maxBuyin, setMaxBuyin] = useState(20000);
  const [tables, setTables] = useState<Awaited<ReturnType<typeof listMyTables>>>([]);
  const openTablesFn = useServerFn(listOpenTables);
  const [openTables, setOpenTables] = useState<Awaited<ReturnType<typeof listOpenTables>>>([]);
  const [pendingTableId, setPendingTableId] = useState<string | null>(null);
  const [pendingCode, setPendingCode] = useState("");

  const loadTables = useCallback(async () => {
    try {
      setTables(await myTables({}));
    } catch {
      setTables([]);
    }
  }, [myTables]);

  const loadOpenTables = useCallback(async () => {
    try {
      setOpenTables(await openTablesFn({}));
    } catch {
      setOpenTables([]);
    }
  }, [openTablesFn]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(Boolean(data.session));
      const host = isHostEmail(data.session?.user.email);
      setIsHost(host);
      if (host) void loadTables();
      if (data.session) void loadOpenTables();
    });
  }, [loadTables, loadOpenTables]);

  const requireAuth = () => {
    if (signedIn) return true;
    navigate({ to: "/auth" });
    return false;
  };

  const handleCreate = async () => {
    if (!requireAuth()) return;
    setBusy(true);
    try {
      const result = await create({
        data: {
          bigBlind,
          smallBlind: Math.max(1, Math.floor(bigBlind / 2)),
          minBuyin,
          maxBuyin,
        },
      });
      navigate({ to: "/mesa/$codigo", params: { codigo: result.code } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos crear la mesa");
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    if (!code.trim()) {
      toast.error("Escribe el código de la mesa");
      return;
    }
    if (!requireAuth()) return;
    setBusy(true);
    try {
      const result = await join({ data: { code } });
      navigate({ to: "/mesa/$codigo", params: { codigo: result.code } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos unirte a la mesa");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="felt-surface min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-5 py-8">
        <header className="flex items-center justify-between">
          <span className="font-display text-2xl tracking-widest text-primary">Killing Ases Poker Club{"\n"}</span>
          {signedIn === false && (
            <Link to="/auth" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
              Entrar
            </Link>
          )}
          {signedIn && (
            <div className="flex items-center gap-3">
              {isHost && (
                <Link
                  to="/panel"
                  className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
                >
                  Panel
                </Link>
              )}
              <button
                type="button"
                onClick={async () => {
                  await supabase.auth.signOut();
                  setSignedIn(false);
                }}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Salir
              </button>
            </div>
          )}

        </header>

        <section className="mt-10">
          <div className="flex gap-2">
            <PlayingCard card="Ah" size="lg" className="-rotate-6" />
            <PlayingCard card="As" size="lg" className="rotate-3" />
            <PlayingCard card="Kd" size="lg" className="-rotate-2" />
            <PlayingCard card="Tc" size="lg" className="rotate-6" />
          </div>
          <h1 className="mt-8 text-5xl leading-none text-foreground">
            No Limit Omaha{"\n\n"}
            <span className="block text-primary">{"\n"}</span>
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">
             Crea una mesa privada, y comparte el código. Cada quien juega desde su teléfono,
            en tiempo real, con fichas de práctica.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          {isHost ? (
          <div className="rounded-2xl border border-brass-soft/40 bg-card/90 p-4">
            <h2 className="text-xl text-foreground">Crear mesa</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-xs text-muted-foreground">
                Ciega grande
                <input
                  type="number"
                  min={2}
                  value={bigBlind}
                  onChange={(e) => setBigBlind(Math.max(2, Number(e.target.value)))}
                  className="tabular mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground outline-none focus:border-brass"
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Ciega chica
                <input
                  type="number"
                  min={1}
                  value={Math.max(1, Math.floor(bigBlind / 2))}
                  readOnly
                  className="tabular mt-1 w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-base text-muted-foreground outline-none"
                />
              </label>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-xs text-muted-foreground">
                Compra mínima
                <input
                  type="number"
                  min={1}
                  step={100}
                  value={minBuyin}
                  onChange={(e) => setMinBuyin(Math.max(1, Number(e.target.value)))}
                  className="tabular mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground outline-none focus:border-brass"
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Compra máxima
                <input
                  type="number"
                  min={1}
                  step={100}
                  value={maxBuyin}
                  onChange={(e) => setMaxBuyin(Math.max(1, Number(e.target.value)))}
                  className="tabular mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground outline-none focus:border-brass"
                />
              </label>
            </div>
            <p className="mt-2 text-[0.7rem] text-muted-foreground">
              Cada jugador elige su propia compra dentro de este rango. Tú puedes agregar o retirar
              fichas después desde el banco de la mesa. Las mesas quedan abiertas hasta que las
              cierres.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={handleCreate}
              className="mt-4 w-full rounded-xl bg-primary py-3 font-display text-lg tracking-wide text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Crear mesa
            </button>
          </div>
          ) : (
            <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
              <h2 className="text-xl text-foreground">Eres invitado</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Solo el anfitrión del club crea las mesas y reparte las fichas. Pídele el código y
                entra aquí abajo.
              </p>
            </div>
          )}

          {isHost && tables.length > 0 && (
            <div className="rounded-2xl border border-brass-soft/40 bg-card/80 p-4">
              <h2 className="text-xl text-foreground">Tus mesas abiertas</h2>
              <ul className="mt-3 space-y-2">
                {tables.map((t) => (
                  <li
                    key={t.code}
                    className="flex items-center gap-2 rounded-xl border border-border/60 bg-felt-deep/40 p-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {t.name} ·{" "}
                        <span className="font-display tracking-[0.2em] text-primary">{t.code}</span>
                      </p>
                      <p className="tabular text-xs text-muted-foreground">
                        {t.players} jugador{t.players === 1 ? "" : "es"} · ciegas {t.smallBlind}/
                        {t.bigBlind} · compra {t.minBuyin.toLocaleString("es-MX")}–
                        {t.maxBuyin.toLocaleString("es-MX")} · mano #{t.handNo}
                      </p>
                    </div>
                    <Link
                      to="/mesa/$codigo"
                      params={{ codigo: t.code }}
                      className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
                    >
                      Abrir
                    </Link>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await close({ data: { code: t.code } });
                          await loadTables();
                          await loadOpenTables();
                          toast.success("Mesa cerrada");
                        } catch (error) {
                          toast.error(
                            error instanceof Error ? error.message : "No pudimos cerrar la mesa",
                          );
                        } finally {
                          setBusy(false);
                        }
                      }}
                      className="rounded-lg border border-border/70 px-3 py-1.5 text-sm text-muted-foreground hover:text-destructive disabled:opacity-50"
                    >
                      Cerrar
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {signedIn && (
            <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
              <h2 className="text-xl text-foreground">Mesas disponibles</h2>
              {openTables.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  No hay mesas abiertas ahora mismo. Pregúntale al anfitrión.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {openTables.map((t) => (
                    <li
                      key={t.id}
                      className="rounded-xl border border-border/60 bg-felt-deep/40 p-3"
                    >
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">{t.name}</p>
                          <p className="text-xs text-primary">
                            {t.gameVariant === "omaha" ? "No Limit Omaha" : t.gameVariant}
                          </p>
                          <p className="tabular mt-1 text-xs text-muted-foreground">
                            Ciegas {t.smallBlind}/{t.bigBlind} · {t.seated}/{t.maxSeats} sentados ·
                            compra {t.minBuyin.toLocaleString("es-MX")}–
                            {t.maxBuyin.toLocaleString("es-MX")}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPendingCode("");
                            setPendingTableId(pendingTableId === t.id ? null : t.id);
                          }}
                          className="rounded-lg border border-brass px-3 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                        >
                          Entrar
                        </button>
                      </div>

                      {pendingTableId === t.id && (
                        <div className="mt-3 flex gap-2">
                          <input
                            value={pendingCode}
                            onChange={(e) => setPendingCode(e.target.value.toUpperCase())}
                            placeholder="CÓDIGO"
                            maxLength={8}
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-center font-display text-lg tracking-[0.25em] text-foreground outline-none focus:border-brass"
                          />
                          <button
                            type="button"
                            disabled={busy}
                            onClick={async () => {
                              if (!pendingCode.trim()) {
                                toast.error("Escribe el código de la mesa");
                                return;
                              }
                              setBusy(true);
                              try {
                                const result = await join({
                                  data: { code: pendingCode, tableId: t.id },
                                });
                                navigate({
                                  to: "/mesa/$codigo",
                                  params: { codigo: result.code },
                                });
                              } catch (error) {
                                toast.error(
                                  error instanceof Error ? error.message : "Código incorrecto",
                                );
                              } finally {
                                setBusy(false);
                              }
                            }}
                            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                          >
                            Ir
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
            <h2 className="text-xl text-foreground">Unirse con código</h2>
            <div className="mt-3 flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={8}
                className="w-full rounded-lg border border-input bg-background px-3 py-3 text-center font-display text-2xl tracking-[0.3em] text-foreground outline-none focus:border-brass"
              />
              <button
                type="button"
                disabled={busy}
                onClick={handleJoin}
                className="rounded-xl border border-brass px-5 font-display text-lg tracking-wide text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
              >
                Entrar
              </button>
            </div>
          </div>
        </section>

        <p className="mt-auto pt-10 text-center text-xs text-muted-foreground">
          Solo fichas de práctica. La variante Mata Ases llega pronto.
        </p>
      </div>
    </main>
  );
}
