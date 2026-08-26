import { evaluateOmaha, newDeck, shuffle, type Card } from "./cards";

export type Street = "preflop" | "flop" | "turn" | "river" | "showdown";

export type PlayerState = {
  seat: number;
  userId: string;
  name: string;
  chips: number;
  bet: number; // committed on the current street
  committed: number; // committed during the whole hand
  folded: boolean;
  allIn: boolean;
  hasActed: boolean;
};

export type Winner = {
  seat: number;
  name: string;
  amount: number;
  handName?: string;
  bestCards?: Card[];
};

export type HandState = {
  handNo: number;
  buttonSeat: number;
  smallBlind: number;
  bigBlind: number;
  street: Street;
  board: Card[];
  deck: Card[];
  hole: Record<string, Card[]>; // seat -> 4 cards
  pot: number;
  currentSeat: number | null;
  currentBet: number;
  minRaise: number;
  players: PlayerState[];
  winners: Winner[];
  revealed: Record<string, Card[]>;
  log: string[];
  complete: boolean;
};

export type PublicHandState = Omit<HandState, "deck" | "hole">;

export type ActionKind = "fold" | "check" | "call" | "raise";

export type SeatInput = { seat: number; userId: string; name: string; chips: number };

export function sanitize(state: HandState): PublicHandState {
  const { deck: _deck, hole: _hole, ...rest } = state;
  return { ...rest, players: rest.players.map((p) => ({ ...p })) };
}

function activeSeats(state: HandState): PlayerState[] {
  return state.players.filter((p) => !p.folded);
}

function canAct(p: PlayerState): boolean {
  return !p.folded && !p.allIn && p.chips > 0;
}

function nextSeatFrom(state: HandState, seat: number, predicate: (p: PlayerState) => boolean) {
  const order = state.players.slice().sort((a, b) => a.seat - b.seat);
  const startIndex = order.findIndex((p) => p.seat === seat);
  for (let i = 1; i <= order.length; i++) {
    const candidate = order[(startIndex + i) % order.length]!;
    if (predicate(candidate)) return candidate.seat;
  }
  return null;
}

function post(state: HandState, player: PlayerState, amount: number) {
  const paid = Math.min(amount, player.chips);
  player.chips -= paid;
  player.bet += paid;
  player.committed += paid;
  state.pot += paid;
  if (player.chips === 0) player.allIn = true;
  return paid;
}

export function startHand(input: {
  handNo: number;
  buttonSeat: number;
  smallBlind: number;
  bigBlind: number;
  seats: SeatInput[];
}): HandState {
  const eligible = input.seats.filter((s) => s.chips > 0).sort((a, b) => a.seat - b.seat);
  if (eligible.length < 2) throw new Error("Se necesitan al menos 2 jugadores con fichas");

  const deck = shuffle(newDeck());
  const players: PlayerState[] = eligible.map((s) => ({
    seat: s.seat,
    userId: s.userId,
    name: s.name,
    chips: s.chips,
    bet: 0,
    committed: 0,
    folded: false,
    allIn: false,
    hasActed: false,
  }));

  const state: HandState = {
    handNo: input.handNo,
    buttonSeat: input.buttonSeat,
    smallBlind: input.smallBlind,
    bigBlind: input.bigBlind,
    street: "preflop",
    board: [],
    deck,
    hole: {},
    pot: 0,
    currentSeat: null,
    currentBet: 0,
    minRaise: input.bigBlind,
    players,
    winners: [],
    revealed: {},
    log: [],
    complete: false,
  };

  // Deal 4 cards each
  for (const p of players) {
    state.hole[String(p.seat)] = state.deck.splice(0, 4);
  }

  const heads = players.length === 2;
  const buttonPresent = players.some((p) => p.seat === input.buttonSeat);
  const buttonSeat = buttonPresent ? input.buttonSeat : players[0]!.seat;
  state.buttonSeat = buttonSeat;

  const sbSeat = heads ? buttonSeat : nextSeatFrom(state, buttonSeat, () => true)!;
  const bbSeat = nextSeatFrom(state, sbSeat, () => true)!;

  const sb = players.find((p) => p.seat === sbSeat)!;
  const bb = players.find((p) => p.seat === bbSeat)!;
  post(state, sb, input.smallBlind);
  post(state, bb, input.bigBlind);
  state.currentBet = Math.max(sb.bet, bb.bet);
  state.minRaise = input.bigBlind;
  state.log.push(`${sb.name} pone la ciega chica (${sb.bet})`);
  state.log.push(`${bb.name} pone la ciega grande (${bb.bet})`);

  state.currentSeat = heads ? sbSeat : nextSeatFrom(state, bbSeat, canAct);
  if (state.currentSeat === null) runOut(state);
  return state;
}

export type LegalActions = {
  seat: number;
  canFold: boolean;
  canCheck: boolean;
  callAmount: number; // chips needed to call (already capped by stack)
  minRaiseTo: number;
  maxRaiseTo: number;
  canRaise: boolean;
  potSize: number;
};

export function legalActions(state: HandState, seat: number): LegalActions | null {
  if (state.complete || state.currentSeat !== seat) return null;
  const p = state.players.find((x) => x.seat === seat);
  if (!p || !canAct(p)) return null;
  const toCall = Math.min(state.currentBet - p.bet, p.chips);
  const maxRaiseTo = p.bet + p.chips;
  const minRaiseTo = Math.min(Math.max(state.currentBet + state.minRaise, state.bigBlind), maxRaiseTo);
  return {
    seat,
    canFold: true,
    canCheck: state.currentBet === p.bet,
    callAmount: toCall,
    minRaiseTo,
    maxRaiseTo,
    canRaise: maxRaiseTo > state.currentBet,
    potSize: state.pot,
  };
}

export function applyAction(
  state: HandState,
  seat: number,
  action: ActionKind,
  raiseTo?: number,
): HandState {
  if (state.complete) throw new Error("La mano ya terminó");
  if (state.currentSeat !== seat) throw new Error("No es tu turno");
  const p = state.players.find((x) => x.seat === seat);
  if (!p || !canAct(p)) throw new Error("No puedes actuar");

  const legal = legalActions(state, seat)!;

  if (action === "fold") {
    p.folded = true;
    p.hasActed = true;
    state.log.push(`${p.name} se retira`);
  } else if (action === "check") {
    if (!legal.canCheck) throw new Error("No puedes pasar, hay una apuesta");
    p.hasActed = true;
    state.log.push(`${p.name} pasa`);
  } else if (action === "call") {
    if (legal.canCheck) throw new Error("No hay nada que igualar");
    const paid = post(state, p, legal.callAmount);
    p.hasActed = true;
    state.log.push(`${p.name} iguala ${paid}`);
  } else if (action === "raise") {
    if (!legal.canRaise) throw new Error("No puedes subir");
    let target = Math.floor(raiseTo ?? 0);
    if (target > legal.maxRaiseTo) target = legal.maxRaiseTo;
    const isAllIn = target === legal.maxRaiseTo;
    if (!isAllIn && target < legal.minRaiseTo) {
      throw new Error(`La subida mínima es ${legal.minRaiseTo}`);
    }
    if (target <= state.currentBet && !isAllIn) throw new Error("Subida inválida");
    const previousBet = state.currentBet;
    const paid = post(state, p, target - p.bet);
    p.hasActed = true;
    if (p.bet > previousBet) {
      state.minRaise = Math.max(p.bet - previousBet, state.bigBlind);
      state.currentBet = p.bet;
      for (const other of state.players) {
        if (other.seat !== p.seat && canAct(other)) other.hasActed = false;
      }
      state.log.push(
        previousBet === 0 ? `${p.name} apuesta ${p.bet}` : `${p.name} sube a ${p.bet} (+${paid})`,
      );
    } else {
      state.log.push(`${p.name} va all-in con ${paid}`);
    }
  }

  advance(state);
  return state;
}

function bettingRoundClosed(state: HandState): boolean {
  const contenders = state.players.filter((p) => !p.folded);
  if (contenders.length <= 1) return true;
  const actors = contenders.filter(canAct);
  if (actors.length === 0) return true;
  if (actors.length === 1 && contenders.length - actors.length > 0) {
    const only = actors[0]!;
    if (only.hasActed && only.bet >= state.currentBet) return true;
  }
  return actors.every((p) => p.hasActed && p.bet === state.currentBet);
}

function advance(state: HandState) {
  const contenders = activeSeats(state);
  if (contenders.length === 1) {
    const winner = contenders[0]!;
    winner.chips += state.pot;
    state.winners = [{ seat: winner.seat, name: winner.name, amount: state.pot }];
    state.log.push(`${winner.name} gana ${state.pot} sin showdown`);
    state.pot = 0;
    state.currentSeat = null;
    state.complete = true;
    state.street = "showdown";
    return;
  }

  if (!bettingRoundClosed(state)) {
    const next = nextSeatFrom(state, state.currentSeat ?? state.buttonSeat, canAct);
    state.currentSeat = next;
    if (next === null) runOut(state);
    return;
  }

  // round closed
  const actors = contenders.filter(canAct);
  if (actors.length <= 1 && contenders.filter((p) => p.allIn).length > 0) {
    const stillBetting = actors.filter((p) => p.bet < state.currentBet);
    if (stillBetting.length === 0) {
      runOut(state);
      return;
    }
  }

  if (state.street === "river") {
    settle(state);
    return;
  }

  nextStreet(state);
}

function nextStreet(state: HandState) {
  for (const p of state.players) {
    p.bet = 0;
    p.hasActed = false;
  }
  state.currentBet = 0;
  state.minRaise = state.bigBlind;

  if (state.street === "preflop") {
    state.deck.shift();
    state.board.push(...state.deck.splice(0, 3));
    state.street = "flop";
  } else if (state.street === "flop") {
    state.deck.shift();
    state.board.push(state.deck.splice(0, 1)[0]!);
    state.street = "turn";
  } else if (state.street === "turn") {
    state.deck.shift();
    state.board.push(state.deck.splice(0, 1)[0]!);
    state.street = "river";
  }

  const next = nextSeatFrom(state, state.buttonSeat, canAct);
  state.currentSeat = next;
  if (next === null || activeSeats(state).filter(canAct).length === 0) {
    runOut(state);
  }
}

/** Everyone is all-in: deal the remaining board and settle. */
function runOut(state: HandState) {
  state.currentSeat = null;
  while (state.board.length < 5) {
    state.deck.shift();
    state.board.push(state.deck.splice(0, 1)[0]!);
  }
  state.street = "river";
  settle(state);
}

function settle(state: HandState) {
  const contenders = activeSeats(state);
  for (const p of contenders) {
    state.revealed[String(p.seat)] = state.hole[String(p.seat)] ?? [];
  }

  const evaluated = new Map<number, { score: number; name: string; cards: string[] }>();
  for (const p of contenders) {
    const result = evaluateOmaha(state.hole[String(p.seat)] ?? [], state.board);
    evaluated.set(p.seat, { score: result.score, name: result.name, cards: result.cards });
  }

  const levels = [...new Set(state.players.map((p) => p.committed).filter((c) => c > 0))].sort(
    (a, b) => a - b,
  );

  const winnersBySeat = new Map<number, Winner>();
  let previous = 0;
  for (const level of levels) {
    let amount = 0;
    for (const p of state.players) {
      amount += Math.max(0, Math.min(p.committed, level) - previous);
    }
    const eligible = contenders.filter((p) => p.committed >= level);
    previous = level;
    if (amount === 0 || eligible.length === 0) continue;

    const bestScore = Math.max(...eligible.map((p) => evaluated.get(p.seat)!.score));
    const winners = eligible.filter((p) => evaluated.get(p.seat)!.score === bestScore);
    const share = Math.floor(amount / winners.length);
    let remainder = amount - share * winners.length;

    for (const w of winners.sort((a, b) => a.seat - b.seat)) {
      let payout = share;
      if (remainder > 0) {
        payout += 1;
        remainder -= 1;
      }
      w.chips += payout;
      const existing = winnersBySeat.get(w.seat);
      const evaluation = evaluated.get(w.seat)!;
      if (existing) {
        existing.amount += payout;
      } else {
        winnersBySeat.set(w.seat, {
          seat: w.seat,
          name: w.name,
          amount: payout,
          handName: evaluation.name,
          bestCards: evaluation.cards,
        });
      }
    }
  }

  state.winners = [...winnersBySeat.values()].sort((a, b) => b.amount - a.amount);
  for (const w of state.winners) {
    state.log.push(`${w.name} gana ${w.amount} con ${w.handName}`);
  }
  state.pot = 0;
  state.currentSeat = null;
  state.street = "showdown";
  state.complete = true;
}
