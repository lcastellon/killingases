import { describe, expect, it } from "vitest";

import { evaluate5, evaluateOmaha } from "./cards";
import {
  applyAction,
  autoActOnTimeout,
  legalActions,
  rakeFor,
  sanitize,
  startHand,
  type HandState,
  type SeatInput,
} from "./engine";

const seats = (count: number, chips = 1000): SeatInput[] =>
  Array.from({ length: count }, (_, i) => ({
    seat: i,
    userId: `u${i}`,
    name: `P${i}`,
    chips,
  }));

function baseHand(count = 3, chips = 1000, turnSeconds = 30): HandState {
  return startHand({
    handNo: 1,
    buttonSeat: 0,
    smallBlind: 25,
    bigBlind: 50,
    seats: seats(count, chips),
    turnSeconds,
    now: 0,
  });
}

/** Deterministically force a hand into a known board / hole configuration. */
function rig(state: HandState, holes: Record<number, string[]>, board: string[]) {
  for (const [seat, cards] of Object.entries(holes)) state.hole[seat] = cards;
  state.board = board;
}

describe("Omaha evaluation (exactly 2 hole + 3 board)", () => {
  it("uses exactly two hole cards and three board cards", () => {
    const result = evaluateOmaha(["As", "Ks", "2h", "3d"], ["Qs", "Js", "Ts", "4c", "5c"]);
    expect(result.name).toBe("Escalera de color");
    expect(result.holeUsed).toHaveLength(2);
    expect(result.boardUsed).toHaveLength(3);
    expect(result.holeUsed.sort()).toEqual(["As", "Ks"]);
  });

  it("cannot make a flush with a single suited hole card", () => {
    // Board has four spades; only one spade in hand -> no flush allowed in Omaha.
    const result = evaluateOmaha(["As", "2h", "3d", "4c"], ["Ks", "Qs", "Js", "9s", "2c"]);
    expect(result.name).not.toBe("Color");
  });

  it("returns 'Sin evaluar' before the flop", () => {
    expect(evaluateOmaha(["As", "Ks", "2h", "3d"], []).name).toBe("Sin evaluar");
  });

  it("ranks 5-card hands correctly", () => {
    expect(evaluate5(["As", "Ks", "Qs", "Js", "Ts"]).category).toBe(8);
    expect(evaluate5(["9h", "9d", "9c", "9s", "2h"]).category).toBe(7);
    expect(evaluate5(["5h", "4d", "3c", "2s", "Ah"]).category).toBe(4); // wheel
  });
});

describe("blinds, button rotation and heads-up", () => {
  it("posts small and big blind from the seats left of the button", () => {
    const state = baseHand(3);
    expect(state.players.find((p) => p.seat === 1)!.bet).toBe(25);
    expect(state.players.find((p) => p.seat === 2)!.bet).toBe(50);
    expect(state.currentSeat).toBe(0); // UTG acts first (button in 3-handed)
    expect(state.pot).toBe(75);
  });

  it("heads-up: button is the small blind and acts first preflop", () => {
    const state = startHand({
      handNo: 2,
      buttonSeat: 0,
      smallBlind: 25,
      bigBlind: 50,
      seats: seats(2),
      now: 0,
    });
    expect(state.players.find((p) => p.seat === 0)!.bet).toBe(25);
    expect(state.players.find((p) => p.seat === 1)!.bet).toBe(50);
    expect(state.currentSeat).toBe(0);
  });

  it("moves the button when a new hand starts on the next seat", () => {
    const first = baseHand(3);
    const nextButton = 1;
    const second = startHand({
      handNo: 2,
      buttonSeat: nextButton,
      smallBlind: 25,
      bigBlind: 50,
      seats: seats(3),
      now: 0,
    });
    expect(first.buttonSeat).toBe(0);
    expect(second.buttonSeat).toBe(1);
    expect(second.players.find((p) => p.seat === 2)!.bet).toBe(25);
    expect(second.players.find((p) => p.seat === 0)!.bet).toBe(50);
  });

  it("falls back to the lowest seat when the button player left the table", () => {
    const state = startHand({
      handNo: 3,
      buttonSeat: 7,
      smallBlind: 25,
      bigBlind: 50,
      seats: seats(3),
      now: 0,
    });
    expect(state.buttonSeat).toBe(0);
  });

  it("refuses to deal with fewer than two funded players", () => {
    expect(() =>
      startHand({
        handNo: 1,
        buttonSeat: 0,
        smallBlind: 25,
        bigBlind: 50,
        seats: [
          { seat: 0, userId: "u0", name: "P0", chips: 1000 },
          { seat: 1, userId: "u1", name: "P1", chips: 0 },
        ],
      }),
    ).toThrow();
  });
});

describe("invalid actions", () => {
  it("rejects acting out of turn", () => {
    const state = baseHand(3);
    expect(() => applyAction(state, 2, "call")).toThrow("No es tu turno");
  });

  it("rejects checking when facing a bet", () => {
    const state = baseHand(3);
    expect(() => applyAction(state, 0, "check")).toThrow();
  });

  it("rejects calling when there is nothing to call", () => {
    const state = baseHand(3);
    applyAction(state, 0, "call");
    applyAction(state, 1, "call");
    applyAction(state, 2, "check"); // BB closes preflop
    expect(state.street).toBe("flop");
    expect(() => applyAction(state, state.currentSeat!, "call")).toThrow();
  });

  it("rejects a raise below the minimum", () => {
    const state = baseHand(3);
    expect(() => applyAction(state, 0, "raise", 60)).toThrow(/subida mínima/i);
  });

  it("legalActions returns null for players who are not on turn", () => {
    const state = baseHand(3);
    expect(legalActions(state, 1)).toBeNull();
    expect(legalActions(state, 0)).not.toBeNull();
  });
});

describe("turn timer", () => {
  it("auto-checks when the clock runs out and checking is legal", () => {
    const state = baseHand(3, 1000, 10);
    applyAction(state, 0, "call", undefined, 0);
    applyAction(state, 1, "call", undefined, 0);
    applyAction(state, 2, "check", undefined, 0);
    expect(state.street).toBe("flop");
    const seat = state.currentSeat!;
    const acted = autoActOnTimeout(state, Date.parse(state.turnEndsAt!) + 1);
    expect(acted).toBe(true);
    expect(state.players.find((p) => p.seat === seat)!.folded).toBe(false);
    expect(state.log.some((l) => l.includes("sin tiempo"))).toBe(true);
  });

  it("auto-folds a disconnected player facing a bet", () => {
    const state = baseHand(3, 1000, 10);
    const seat = state.currentSeat!;
    autoActOnTimeout(state, Date.parse(state.turnEndsAt!) + 1);
    expect(state.players.find((p) => p.seat === seat)!.folded).toBe(true);
    expect(state.players.find((p) => p.seat === seat)!.autoActions).toBe(1);
  });

  it("does nothing before the deadline", () => {
    const state = baseHand(3, 1000, 30);
    expect(autoActOnTimeout(state, Date.parse(state.turnEndsAt!) - 1000)).toBe(false);
  });
});

describe("pots, ties and all-ins", () => {
  it("awards the pot without showdown when everyone folds", () => {
    const state = baseHand(3);
    applyAction(state, 0, "fold");
    applyAction(state, 1, "fold");
    expect(state.complete).toBe(true);
    expect(state.winners).toHaveLength(1);
    expect(state.winners[0]!.seat).toBe(2);
    // sin showdown la casa no cobra comisión
    expect(state.winners[0]!.amount).toBe(75);
    expect(state.pot).toBe(0);
  });

  it("splits the pot on an exact tie", () => {
    const state = startHand({
      handNo: 1,
      buttonSeat: 0,
      smallBlind: 25,
      bigBlind: 50,
      seats: seats(2, 1000),
      now: 0,
    });
    rig(
      state,
      { 0: ["As", "Kh", "2c", "3d"], 1: ["Ad", "Kc", "2h", "3s"] },
      ["Qs", "Jh", "Td", "7c", "4h"],
    );
    applyAction(state, 0, "call");
    applyAction(state, 1, "check");
    // flop, turn, river: everyone checks down
    for (let i = 0; i < 6 && !state.complete; i++) {
      applyAction(state, state.currentSeat!, "check");
    }
    expect(state.complete).toBe(true);
    expect(state.winners).toHaveLength(2);
    expect(state.winners[0]!.amount).toBe(49); // 100 de bote menos 2 de comisión
    expect(state.rake).toBe(2);
    expect(state.players.every((p) => p.chips === 999)).toBe(true);
  });

  it("builds a side pot the short stack cannot win", () => {
    const state = startHand({
      handNo: 1,
      buttonSeat: 0,
      smallBlind: 25,
      bigBlind: 50,
      seats: [
        { seat: 0, userId: "u0", name: "Corto", chips: 100 },
        { seat: 1, userId: "u1", name: "Medio", chips: 1000 },
        { seat: 2, userId: "u2", name: "Grande", chips: 1000 },
      ],
      now: 0,
    });
    // Short stack wins the main pot (four kings); "Medio" wins the side pot (full house).
    rig(
      state,
      {
        0: ["As", "Ah", "Kc", "Kd"], // trip aces
        1: ["2c", "2d", "7h", "8h"],
        2: ["Ac", "Ad", "9h", "9c"],
      },
      ["Ks", "Kh", "2s", "5d", "6d"],
    );
    applyAction(state, 0, "raise", 100); // all-in for 100
    applyAction(state, 1, "raise", 1000); // all-in
    applyAction(state, 2, "call"); // all-in call -> board runs out
    expect(state.complete).toBe(true);


    const total = state.players.reduce((sum, p) => sum + p.chips, 0);
    expect(state.rake).toBe(42); // 2% de 2100
    expect(total).toBe(2100 - 42); // fichas conservadas menos la comisión
    expect(state.pot).toBe(0);
    const short = state.players.find((p) => p.seat === 0)!;
    expect(short.chips).toBe(258); // bote principal (3 x 100) menos la comisión
    expect(state.winners.some((w) => w.seat === 1)).toBe(true); // full house wins the side pot
  });

  it("runs the board out when all players are all-in", () => {
    const state = startHand({
      handNo: 1,
      buttonSeat: 0,
      smallBlind: 25,
      bigBlind: 50,
      seats: seats(2, 200),
      now: 0,
    });
    applyAction(state, 0, "raise", 200);
    applyAction(state, 1, "call");
    expect(state.complete).toBe(true);
    expect(state.board).toHaveLength(5);
    expect(state.currentSeat).toBeNull();
    expect(state.rake).toBe(8);
    expect(state.players.reduce((s, p) => s + p.chips, 0)).toBe(392);
  });

  it("explains each showdown hand with the exact cards used", () => {
    const state = startHand({
      handNo: 1,
      buttonSeat: 0,
      smallBlind: 25,
      bigBlind: 50,
      seats: seats(2, 200),
      now: 0,
    });
    rig(
      state,
      { 0: ["As", "Ks", "2c", "3d"], 1: ["7h", "7d", "8c", "9s"] },
      ["Qs", "Js", "Ts", "4c", "5h"],
    );
    applyAction(state, 0, "raise", 200);
    applyAction(state, 1, "call");
    expect(state.showdown).toHaveLength(2);
    for (const entry of state.showdown) {
      expect(entry.holeUsed).toHaveLength(2);
      expect(entry.boardUsed).toHaveLength(3);
      expect(entry.cards).toHaveLength(5);
      expect(entry.description).toContain("de la mesa");
    }
    expect(state.showdown[0]!.seat).toBe(0);
    expect(state.showdown[0]!.handName).toBe("escalera real");
  });
});

describe("reconnection safety", () => {
  it("never leaks the deck or hole cards in the public state", () => {
    const state = baseHand(3);
    const publicState = sanitize(state) as unknown as Record<string, unknown>;
    expect(publicState["deck"]).toBeUndefined();
    expect(publicState["hole"]).toBeUndefined();
    expect(JSON.stringify(publicState)).not.toContain(state.hole["0"]![0]!);
  });

  it("keeps seat, chips and turn state so a reload can restore the view", () => {
    const state = baseHand(3);
    const restored = JSON.parse(JSON.stringify(sanitize(state)));
    expect(restored.currentSeat).toBe(state.currentSeat);
    expect(restored.turnEndsAt).toBe(state.turnEndsAt);
    expect(restored.players).toHaveLength(3);
    expect(restored.players[0].chips).toBe(state.players[0]!.chips);
  });
});

describe("comisión de la casa", () => {
  it("cobra 2% del bote con techo de 4 ciegas grandes por mano", () => {
    expect(rakeFor(0, 50)).toBe(0);
    expect(rakeFor(100, 50)).toBe(2);
    expect(rakeFor(999, 50)).toBe(19);
    expect(rakeFor(10_000, 50)).toBe(200);
    expect(rakeFor(1_000_000, 50)).toBe(200);
    expect(rakeFor(1_000_000, 50, false)).toBe(0);
  });
});
