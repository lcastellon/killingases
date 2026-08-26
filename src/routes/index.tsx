import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { createTable, joinTable } from "@/lib/poker/table.functions";
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
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [bigBlind, setBigBlind] = useState(50);
  const [startingChips, setStartingChips] = useState(5000);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
  }, []);

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
          startingChips,
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
            Omaha No Limit
            <span className="block text-primary">con tus amigos</span>
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Crea una mesa privada, comparte el código y reparte. Cada quien juega desde su teléfono,
            en tiempo real, con fichas de práctica.
          </p>
        </section>

        <section className="mt-10 space-y-4">
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
                Fichas iniciales
                <input
                  type="number"
                  min={100}
                  step={100}
                  value={startingChips}
                  onChange={(e) => setStartingChips(Math.max(100, Number(e.target.value)))}
                  className="tabular mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground outline-none focus:border-brass"
                />
              </label>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={handleCreate}
              className="mt-4 w-full rounded-xl bg-primary py-3 font-display text-lg tracking-wide text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Crear mesa
            </button>
          </div>

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
