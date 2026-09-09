import type { GameVariant } from "./engine";

export type TournamentFormat = "sit_go" | "scheduled";
export type TournamentStatus = "registering" | "running" | "completed" | "cancelled";
export type TournamentEntryStatus =
  "registered" | "active" | "rebuy_pending" | "eliminated" | "winner" | "cancelled";

export type BlindLevel = {
  smallBlind: number;
  bigBlind: number;
};

export type PrizePlace = {
  place: number;
  percent: number;
};

export type TournamentEntryView = {
  userId: string;
  displayName: string;
  status: TournamentEntryStatus;
  seat: number;
  rebuys: number;
  finishPosition: number | null;
  prizeAmount: number;
  paidAt: string | null;
};

export type TournamentView = {
  id: string;
  format: TournamentFormat;
  status: TournamentStatus;
  buyIn: number;
  houseFeePercent: number;
  startingStack: number;
  minPlayers: number;
  maxPlayers: number;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  registrationIsOpen: boolean;
  allowRebuys: boolean;
  maxRebuys: number;
  rebuyUntilLevel: number;
  blindIntervalMinutes: number;
  blindLevels: BlindLevel[];
  prizeStructure: PrizePlace[];
  currentLevel: number;
  currentBlinds: BlindLevel;
  nextLevelAt: string | null;
  entriesCount: number;
  remainingPlayers: number;
  prizePool: number;
  houseFeeTotal: number;
  startedAt: string | null;
  completedAt: string | null;
  hasPendingRebuys: boolean;
  entries: TournamentEntryView[];
  me: TournamentEntryView | null;
};

export type CreateTournamentInput = {
  name?: string;
  format: TournamentFormat;
  gameVariant?: GameVariant;
  buyIn: number;
  houseFeePercent?: number;
  startingStack: number;
  minPlayers: number;
  maxPlayers: number;
  registrationOpensAt?: string | null;
  registrationClosesAt?: string | null;
  allowRebuys?: boolean;
  maxRebuys?: number;
  rebuyUntilLevel?: number;
  blindIntervalMinutes: number;
  blindLevels: BlindLevel[];
  prizeStructure: PrizePlace[];
};

export const DEFAULT_BLIND_LEVELS: BlindLevel[] = [
  { smallBlind: 25, bigBlind: 50 },
  { smallBlind: 50, bigBlind: 100 },
  { smallBlind: 75, bigBlind: 150 },
  { smallBlind: 100, bigBlind: 200 },
  { smallBlind: 150, bigBlind: 300 },
  { smallBlind: 200, bigBlind: 400 },
  { smallBlind: 300, bigBlind: 600 },
  { smallBlind: 400, bigBlind: 800 },
  { smallBlind: 600, bigBlind: 1200 },
  { smallBlind: 800, bigBlind: 1600 },
  { smallBlind: 1000, bigBlind: 2000 },
  { smallBlind: 1500, bigBlind: 3000 },
  { smallBlind: 2000, bigBlind: 4000 },
];

export const DEFAULT_PRIZE_STRUCTURE: PrizePlace[] = [
  { place: 1, percent: 50 },
  { place: 2, percent: 30 },
  { place: 3, percent: 20 },
];

function wholeNumber(value: unknown, name: string, min: number, max: number): number {
  const parsed = Math.trunc(Number(value));
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} debe estar entre ${min} y ${max}`);
  }
  return parsed;
}

export function normalizeTournamentInput(input: CreateTournamentInput): CreateTournamentInput {
  const format: TournamentFormat = input.format === "scheduled" ? "scheduled" : "sit_go";
  const gameVariant: GameVariant = input.gameVariant === "omaha5" ? "omaha5" : "omaha";
  const buyIn = wholeNumber(input.buyIn, "El buy-in", 1, 10_000_000);
  const startingStack = wholeNumber(input.startingStack, "Los puntos iniciales", 100, 10_000_000);
  const minPlayers = wholeNumber(input.minPlayers, "El mínimo de jugadores", 2, 8);
  const maxPlayers = wholeNumber(input.maxPlayers, "El máximo de jugadores", 2, 8);
  if (minPlayers > maxPlayers) throw new Error("El mínimo no puede superar el cupo máximo");

  const houseFeePercent = Math.round(Number(input.houseFeePercent ?? 10) * 100) / 100;
  if (!Number.isFinite(houseFeePercent) || houseFeePercent < 0 || houseFeePercent > 30) {
    throw new Error("La comisión de la casa debe estar entre 0% y 30%");
  }

  const blindIntervalMinutes = wholeNumber(
    input.blindIntervalMinutes,
    "El intervalo de ciegas",
    1,
    180,
  );
  if (!Array.isArray(input.blindLevels) || input.blindLevels.length < 2) {
    throw new Error("Agrega al menos dos niveles de ciegas");
  }
  if (input.blindLevels.length > 50) throw new Error("El máximo es de 50 niveles de ciegas");
  const blindLevels = input.blindLevels.map((level, index) => {
    const smallBlind = wholeNumber(
      level.smallBlind,
      `Ciega chica del nivel ${index + 1}`,
      1,
      10_000_000,
    );
    const bigBlind = wholeNumber(
      level.bigBlind,
      `Ciega grande del nivel ${index + 1}`,
      2,
      20_000_000,
    );
    if (smallBlind >= bigBlind) {
      throw new Error(`En el nivel ${index + 1}, la ciega chica debe ser menor`);
    }
    return { smallBlind, bigBlind };
  });

  if (!Array.isArray(input.prizeStructure) || input.prizeStructure.length === 0) {
    throw new Error("Agrega al menos un lugar premiado");
  }
  const prizeStructure = input.prizeStructure
    .map((prize) => ({
      place: wholeNumber(prize.place, "El lugar premiado", 1, 8),
      percent: Math.round(Number(prize.percent) * 100) / 100,
    }))
    .sort((a, b) => a.place - b.place);
  const places = new Set(prizeStructure.map((prize) => prize.place));
  if (places.size !== prizeStructure.length) throw new Error("No repitas lugares premiados");
  if (prizeStructure.some((prize) => !Number.isFinite(prize.percent) || prize.percent <= 0)) {
    throw new Error("Cada porcentaje de premio debe ser mayor que cero");
  }
  if (prizeStructure.some((prize, index) => prize.place !== index + 1)) {
    throw new Error("Los premios deben comenzar en primer lugar y ser consecutivos");
  }
  if (prizeStructure.at(-1)!.place > minPlayers) {
    throw new Error("No puede haber más lugares premiados que el mínimo de jugadores");
  }
  const prizeTotal = prizeStructure.reduce((sum, prize) => sum + prize.percent, 0);
  if (Math.abs(prizeTotal - 100) > 0.01) {
    throw new Error("Los porcentajes de premios deben sumar 100%");
  }

  let registrationOpensAt: string | null = null;
  let registrationClosesAt: string | null = null;
  if (format === "scheduled") {
    const opens = Date.parse(input.registrationOpensAt ?? "");
    const closes = Date.parse(input.registrationClosesAt ?? "");
    if (!Number.isFinite(opens) || !Number.isFinite(closes)) {
      throw new Error("Define el inicio y el cierre de inscripción");
    }
    if (closes <= opens) throw new Error("El cierre debe ser posterior al inicio de inscripción");
    if (closes <= Date.now()) throw new Error("El cierre de inscripción debe estar en el futuro");
    registrationOpensAt = new Date(opens).toISOString();
    registrationClosesAt = new Date(closes).toISOString();
  }

  const allowRebuys = Boolean(input.allowRebuys);
  const maxRebuys = allowRebuys
    ? wholeNumber(input.maxRebuys ?? 1, "El máximo de rebuys", 1, 10)
    : 0;
  const rebuyUntilLevel = allowRebuys
    ? wholeNumber(
        input.rebuyUntilLevel ?? Math.min(4, blindLevels.length),
        "El nivel límite de rebuys",
        1,
        blindLevels.length,
      )
    : 0;

  return {
    name: String(input.name ?? "")
      .trim()
      .slice(0, 60),
    format,
    gameVariant,
    buyIn,
    houseFeePercent,
    startingStack,
    minPlayers,
    maxPlayers,
    registrationOpensAt,
    registrationClosesAt,
    allowRebuys,
    maxRebuys,
    rebuyUntilLevel,
    blindIntervalMinutes,
    blindLevels,
    prizeStructure,
  };
}

export function blindLevelAt(
  levels: BlindLevel[],
  startedAt: string,
  intervalMinutes: number,
  now = Date.now(),
) {
  const elapsed = Math.max(0, now - Date.parse(startedAt));
  const index = Math.min(levels.length - 1, Math.floor(elapsed / (intervalMinutes * 60_000)));
  return { level: index + 1, blinds: levels[index]! };
}

export function ordinalPlace(place: number): string {
  return `${place}.º`;
}
