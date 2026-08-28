import { useRef, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { updateMyProfile } from "@/lib/poker/table.functions";
import { FELT_THEMES, applyFeltTheme } from "@/lib/poker/theme";
import { cn } from "@/lib/utils";

export function PlayerSettings({
  open,
  onClose,
  userId,
  displayName,
  avatarUrl,
  feltTheme,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  feltTheme: string;
  onSaved: () => void;
}) {
  const save = useServerFn(updateMyProfile);
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(displayName);
  const [theme, setTheme] = useState(feltTheme);
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const uploadAvatar = async (file: File) => {
    if (!file.type.startsWith("image/")) throw new Error("Selecciona una imagen");
    if (file.size > 5 * 1024 * 1024) throw new Error("La imagen no debe pasar de 5 MB");
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${userId}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw new Error(error.message);
    await save({ data: { avatarPath: path } });
    setPreview(URL.createObjectURL(file));
    toast.success("Avatar actualizado");
    onSaved();
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    uploadAvatar(file)
      .catch((e) => toast.error(e instanceof Error ? e.message : "No pudimos subir la imagen"))
      .finally(() => setBusy(false));
  };

  const saveRest = async () => {
    setBusy(true);
    try {
      await save({ data: { displayName: name, feltTheme: theme } });
      applyFeltTheme(theme);
      toast.success("Preferencias guardadas");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos guardar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 p-4 backdrop-blur sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-brass-soft/50 bg-card p-4 shadow-table">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl tracking-wide text-primary">Tu perfil</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Cerrar
          </button>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border border-brass bg-felt/60 font-display text-xl text-primary"
            aria-label="Cambiar imagen de avatar"
          >
            {preview ? (
              <img src={preview} alt="Tu avatar" className="h-full w-full object-cover" />
            ) : (
              name.slice(0, 2).toUpperCase()
            )}
            <span className="absolute inset-x-0 bottom-0 bg-felt-deep/85 py-0.5 text-[0.55rem] uppercase tracking-widest text-primary">
              Cambiar
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <label
              htmlFor="display-name"
              className="text-[0.65rem] uppercase tracking-widest text-muted-foreground"
            >
              Nombre visible
            </label>
            <input
              id="display-name"
              value={name}
              maxLength={24}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-base outline-none focus:border-brass"
            />
            {preview && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  save({ data: { avatarPath: null } })
                    .then(() => {
                      setPreview(null);
                      onSaved();
                    })
                    .catch(() => toast.error("No pudimos quitar la imagen"))
                    .finally(() => setBusy(false));
                }}
                className="mt-2 text-xs text-muted-foreground hover:text-destructive"
              >
                Quitar imagen
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>

        <div className="mt-5">
          <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
            Color del paño
          </p>
          <div className="mt-2 grid grid-cols-5 gap-2">
            {FELT_THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTheme(t.id);
                  applyFeltTheme(t.id);
                }}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border p-1.5 transition-all",
                  theme === t.id ? "border-brass" : "border-border/60",
                )}
              >
                <span
                  className="h-8 w-full rounded-md border border-brass-soft/40"
                  style={{
                    background: `radial-gradient(circle at 50% 35%, ${t.vars.felt} 0%, ${t.vars.deep} 90%)`,
                  }}
                />
                <span className="text-[0.55rem] uppercase tracking-wide text-muted-foreground">
                  {t.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => void saveRest()}
          className="mt-5 w-full rounded-xl bg-primary py-3 font-display text-lg tracking-wide text-primary-foreground disabled:opacity-50"
        >
          Guardar
        </button>
      </div>
    </div>
  );
}
