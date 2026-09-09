import { describe, expect, it } from "vitest";

import {
  blindLevelAt,
  DEFAULT_BLIND_LEVELS,
  DEFAULT_PRIZE_STRUCTURE,
  normalizeTournamentInput,
} from "./tournament";

const valid = {
  format: "sit_go" as const,
  buyIn: 1000,
  startingStack: 5000,
  minPlayers: 4,
  maxPlayers: 8,
  blindIntervalMinutes: 10,
  blindLevels: DEFAULT_BLIND_LEVELS,
  prizeStructure: DEFAULT_PRIZE_STRUCTURE,
};

describe("configuración de torneos", () => {
  it("usa 10% para la casa por defecto", () => {
    expect(normalizeTournamentInput(valid).houseFeePercent).toBe(10);
  });

  it("exige que los premios sumen 100%", () => {
    expect(() =>
      normalizeTournamentInput({
        ...valid,
        prizeStructure: [
          { place: 1, percent: 60 },
          { place: 2, percent: 30 },
        ],
      }),
    ).toThrow("sumar 100%");
  });

  it("avanza y conserva el último nivel de ciegas", () => {
    const started = "2026-09-09T12:00:00.000Z";
    expect(
      blindLevelAt(DEFAULT_BLIND_LEVELS, started, 10, Date.parse(started) + 21 * 60_000).level,
    ).toBe(3);
    expect(
      blindLevelAt(DEFAULT_BLIND_LEVELS, started, 10, Date.parse(started) + 999 * 60_000).level,
    ).toBe(DEFAULT_BLIND_LEVELS.length);
  });
});
