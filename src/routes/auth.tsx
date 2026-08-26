import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar a Mata Ases" },
      {
        name: "description",
        content: "Identifícate para crear mesas de Omaha y jugar poker con tus amigos en Mata Ases.",
      },
      { property: "og:title", content: "Entrar a Mata Ases" },
      {
        property: "og:description",
        content: "Crea tu cuenta y siéntate en una mesa de Omaha No Limit con tus amigos.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { display_name: name.trim() || email.split("@")[0] },
          },
        });
        if (error) throw error;
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          navigate({ to: "/" });
        } else {
          toast.success("Cuenta creada. Revisa tu correo para confirmarla.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/" });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos identificarte");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("No pudimos entrar con Google");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/" });
  };

  return (
    <main className="felt-surface flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="font-display text-2xl tracking-widest text-primary">
          MATA ASES
        </Link>
        <h1 className="mt-6 text-3xl text-foreground">
          {mode === "signin" ? "Entrar a la mesa" : "Crear tu jugador"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Necesitamos identificarte para guardar tus fichas y tu asiento.
        </p>

        <button
          type="button"
          onClick={google}
          disabled={busy}
          className="mt-6 w-full rounded-xl border border-brass bg-card py-3 font-semibold text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
        >
          Continuar con Google
        </button>

        <div className="my-5 flex items-center gap-3 text-xs uppercase text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> o con correo
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <label className="block text-xs text-muted-foreground">
              Nombre en la mesa
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="León"
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-3 text-base text-foreground outline-none focus:border-brass"
              />
            </label>
          )}
          <label className="block text-xs text-muted-foreground">
            Correo
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-3 text-base text-foreground outline-none focus:border-brass"
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            Contraseña
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-3 text-base text-foreground outline-none focus:border-brass"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-primary py-3 font-display text-lg tracking-wide text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {mode === "signin" ? "Entrar" : "Crear cuenta"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-5 w-full text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === "signin" ? "No tengo cuenta, crear una" : "Ya tengo cuenta, entrar"}
        </button>
      </div>
    </main>
  );
}
