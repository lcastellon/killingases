import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { createTournament } from "@/lib/poker/tournament.functions";
import {
  DEFAULT_BLIND_LEVELS,
  DEFAULT_PRIZE_STRUCTURE,
  type TournamentFormat,
} from "@/lib/poker/tournament";
import type { GameVariant } from "@/lib/poker/engine";

function localDateTime(date: Date) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

const defaultBlindText = DEFAULT_BLIND_LEVELS.map(
  (level) => `${level.smallBlind}/${level.bigBlind}`,
).join("\n");
const defaultPrizeText = DEFAULT_PRIZE_STRUCTURE.map(
  (prize) => `${prize.place}: ${prize.percent}`,
).join("\n");

function parseBlinds(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const values = line.split(/[\s/,:-]+/).map(Number);
      return { smallBlind: values[0] ?? Number.NaN, bigBlind: values[1] ?? Number.NaN };
    });
}

function parsePrizes(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const values = line.split(/[\s:%,-]+/).map(Number);
      return { place: values[0] ?? Number.NaN, percent: values[1] ?? Number.NaN };
    });
}

export function TournamentCreateForm({
  busy,
  setBusy,
  onCreated,
}: {
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onCreated: (code: string) => void;
}) {
  const create = useServerFn(createTournament);
  const [format, setFormat] = useState<TournamentFormat>("sit_go");
  const [gameVariant, setGameVariant] = useState<Extract<GameVariant, "omaha" | "omaha5">>("omaha");
  const [name, setName] = useState("Sit & Go Omaha");
  const [buyIn, setBuyIn] = useState(1000);
  const [startingStack, setStartingStack] = useState(5000);
  const [minPlayers, setMinPlayers] = useState(4);
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [houseFeePercent, setHouseFeePercent] = useState(10);
  const [allowRebuys, setAllowRebuys] = useState(false);
  const [maxRebuys, setMaxRebuys] = useState(1);
  const [rebuyUntilLevel, setRebuyUntilLevel] = useState(4);
  const [blindIntervalMinutes, setBlindIntervalMinutes] = useState(10);
  const [blindText, setBlindText] = useState(defaultBlindText);
  const [prizeText, setPrizeText] = useState(defaultPrizeText);
  const [registrationOpensAt, setRegistrationOpensAt] = useState(localDateTime(new Date()));
  const [registrationClosesAt, setRegistrationClosesAt] = useState(
    localDateTime(new Date(Date.now() + 60 * 60_000)),
  );

  const handleCreate = async () => {
    setBusy(true);
    try {
      const result = await create({
        data: {
          name,
          format,
          gameVariant,
          buyIn,
          houseFeePercent,
          startingStack,
          minPlayers,
          maxPlayers,
          registrationOpensAt:
            format === "scheduled" ? new Date(registrationOpensAt).toISOString() : null,
          registrationClosesAt:
            format === "scheduled" ? new Date(registrationClosesAt).toISOString() : null,
          allowRebuys,
          maxRebuys,
          rebuyUntilLevel,
          blindIntervalMinutes,
          blindLevels: parseBlinds(blindText),
          prizeStructure: parsePrizes(prizeText),
        },
      });
      toast.success("Torneo creado");
      onCreated(result.code);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos crear el torneo");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-primary/50 bg-card/90 p-4">
      <h2 className="text-xl text-foreground">Crear torneo</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        El buy-in sale del banco. La casa retiene 10% por defecto y el resto forma los premios.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Formato">
          <select value={format} onChange={(e) => setFormat(e.target.value as TournamentFormat)}>
            <option value="sit_go">Sit & Go · inicia al llenarse</option>
            <option value="scheduled">Programado · fecha de cierre</option>
          </select>
        </Field>
        <Field label="Variante">
          <select
            value={gameVariant}
            onChange={(e) => setGameVariant(e.target.value === "omaha5" ? "omaha5" : "omaha")}
          >
            <option value="omaha">Omaha · 4 cartas</option>
            <option value="omaha5">Omaha 5 · 5 cartas</option>
          </select>
        </Field>
        <Field label="Nombre">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </Field>
        <Field label="Buy-in">
          <input
            type="number"
            min={1}
            value={buyIn}
            onChange={(e) => setBuyIn(Number(e.target.value))}
          />
        </Field>
        <Field label="Puntos iniciales">
          <input
            type="number"
            min={100}
            value={startingStack}
            onChange={(e) => setStartingStack(Number(e.target.value))}
          />
        </Field>
        <Field label="Comisión de la casa (%)">
          <input
            type="number"
            min={0}
            max={30}
            step={0.5}
            value={houseFeePercent}
            onChange={(e) => setHouseFeePercent(Number(e.target.value))}
          />
        </Field>
        <Field label="Mínimo de jugadores">
          <input
            type="number"
            min={2}
            max={8}
            value={minPlayers}
            onChange={(e) => setMinPlayers(Number(e.target.value))}
          />
        </Field>
        <Field label="Cupo máximo">
          <input
            type="number"
            min={2}
            max={8}
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(Number(e.target.value))}
          />
        </Field>
      </div>

      {format === "scheduled" && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Abre inscripción">
            <input
              type="datetime-local"
              value={registrationOpensAt}
              onChange={(e) => setRegistrationOpensAt(e.target.value)}
            />
          </Field>
          <Field label="Cierra inscripción / inicia">
            <input
              type="datetime-local"
              value={registrationClosesAt}
              onChange={(e) => setRegistrationClosesAt(e.target.value)}
            />
          </Field>
        </div>
      )}

      <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-xl border border-input bg-background px-3 py-2.5 text-sm">
        <input
          type="checkbox"
          checked={allowRebuys}
          onChange={(e) => setAllowRebuys(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        <span>
          <span className="font-semibold text-foreground">Permitir rebuys</span>
          <span className="block text-xs text-muted-foreground">
            Desactivado = torneo freezeout
          </span>
        </span>
      </label>
      {allowRebuys && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Máximo por jugador">
            <input
              type="number"
              min={1}
              max={10}
              value={maxRebuys}
              onChange={(e) => setMaxRebuys(Number(e.target.value))}
            />
          </Field>
          <Field label="Hasta el nivel">
            <input
              type="number"
              min={1}
              max={50}
              value={rebuyUntilLevel}
              onChange={(e) => setRebuyUntilLevel(Number(e.target.value))}
            />
          </Field>
        </div>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Niveles de ciegas · uno por línea (25/50)">
          <textarea rows={8} value={blindText} onChange={(e) => setBlindText(e.target.value)} />
        </Field>
        <div className="space-y-3">
          <Field label="Minutos por nivel">
            <input
              type="number"
              min={1}
              max={180}
              value={blindIntervalMinutes}
              onChange={(e) => setBlindIntervalMinutes(Number(e.target.value))}
            />
          </Field>
          <Field label="Premios · lugar: porcentaje">
            <textarea rows={5} value={prizeText} onChange={(e) => setPrizeText(e.target.value)} />
          </Field>
          <p className="text-[0.68rem] text-muted-foreground">
            Los porcentajes deben sumar 100. Ejemplo: 1:50, 2:30, 3:20.
          </p>
        </div>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => void handleCreate()}
        className="mt-4 w-full rounded-xl bg-primary py-3 font-display text-lg tracking-wide text-primary-foreground disabled:opacity-50"
      >
        Crear {format === "sit_go" ? "Sit & Go" : "torneo programado"}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-xs text-muted-foreground [&_input]:mt-1 [&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:border-input [&_input]:bg-background [&_input]:px-3 [&_input]:py-2 [&_input]:text-base [&_input]:text-foreground [&_select]:mt-1 [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-input [&_select]:bg-background [&_select]:px-3 [&_select]:py-2 [&_select]:text-sm [&_select]:text-foreground [&_textarea]:mt-1 [&_textarea]:w-full [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-input [&_textarea]:bg-background [&_textarea]:px-3 [&_textarea]:py-2 [&_textarea]:font-mono [&_textarea]:text-sm [&_textarea]:text-foreground">
      {label}
      {children}
    </label>
  );
}
