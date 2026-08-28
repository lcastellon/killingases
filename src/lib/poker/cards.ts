export const RANKS = "23456789TJQKA";
export const SUITS = ["s", "h", "d", "c"] as const;

export type Card = string; // e.g. "As", "Td", "9c"

export const SUIT_SYMBOL: Record<string, string> = {
  s: "\u2660",
  h: "\u2665",
  d: "\u2666",
  c: "\u2663",
};

export const RANK_LABEL: Record<string, string> = {
  T: "10",
};

export function rankOf(card: Card): number {
  return RANKS.indexOf(card[0]!) + 2;
}

export function suitOf(card: Card): string {
  return card[1]!;
}

export function isRed(card: Card): boolean {
  const s = suitOf(card);
  return s === "h" || s === "d";
}

export function cardLabel(card: Card): string {
  const r = card[0]!;
  return RANK_LABEL[r] ?? r;
}

export function newDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) {
    for (const r of RANKS) deck.push(r + s);
  }
  return deck;
}

export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = out[i]!;
    out[i] = out[j]!;
    out[j] = a;
  }
  return out;
}

const CATEGORY_NAMES = [
  "Carta alta",
  "Par",
  "Doble par",
  "Trío",
  "Escalera",
  "Color",
  "Full",
  "Póker",
  "Escalera de color",
];

export type HandScore = {
  score: number;
  category: number;
  name: string;
  cards: Card[];
  holeUsed: Card[];
  boardUsed: Card[];
};


function straightHigh(uniqueDesc: number[]): number | null {
  const set = new Set(uniqueDesc);
  const values = uniqueDesc.slice();
  if (set.has(14)) values.push(1);
  let run = 1;
  for (let i = 1; i < values.length; i++) {
    if (values[i] === values[i - 1]! - 1) {
      run++;
      if (run >= 5) return values[i - 4]!;
    } else if (values[i] !== values[i - 1]) {
      run = 1;
    }
  }
  return null;
}

/** Evaluates exactly 5 cards. Higher score wins. */
export function evaluate5(cards: Card[]): HandScore {
  const ranks = cards.map(rankOf);
  const suits = cards.map(suitOf);
  const flush = suits.every((s) => s === suits[0]);

  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  const grouped = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const shape = grouped.map(([, c]) => c).join("");
  const ordered = grouped.map(([r]) => r);

  const uniqueDesc = [...new Set(ranks)].sort((a, b) => b - a);
  const sHigh = uniqueDesc.length === 5 ? straightHigh(uniqueDesc) : null;

  let category: number;
  let tiebreak: number[];

  if (flush && sHigh !== null) {
    category = 8;
    tiebreak = [sHigh];
  } else if (shape === "41") {
    category = 7;
    tiebreak = ordered;
  } else if (shape === "32") {
    category = 6;
    tiebreak = ordered;
  } else if (flush) {
    category = 5;
    tiebreak = uniqueDesc;
  } else if (sHigh !== null) {
    category = 4;
    tiebreak = [sHigh];
  } else if (shape === "311") {
    category = 3;
    tiebreak = ordered;
  } else if (shape === "221") {
    category = 2;
    tiebreak = ordered;
  } else if (shape === "2111") {
    category = 1;
    tiebreak = ordered;
  } else {
    category = 0;
    tiebreak = uniqueDesc;
  }

  let score = category;
  for (let i = 0; i < 5; i++) {
    score = score * 15 + (tiebreak[i] ?? 0);
  }

  return {
    score,
    category,
    name: CATEGORY_NAMES[category]!,
    cards: cards.slice(),
    holeUsed: [],
    boardUsed: [],
  };

}

function combinations<T>(items: T[], k: number): T[][] {
  const result: T[][] = [];
  const combo: T[] = [];
  const walk = (start: number) => {
    if (combo.length === k) {
      result.push(combo.slice());
      return;
    }
    for (let i = start; i < items.length; i++) {
      combo.push(items[i]!);
      walk(i + 1);
      combo.pop();
    }
  };
  walk(0);
  return result;
}

/**
 * Omaha: exactly 2 hole cards + exactly 3 board cards.
 * Returns the winning 5 cards plus which 2 hole / 3 board cards were used.
 */
export function evaluateOmaha(hole: Card[], board: Card[]): HandScore {
  if (hole.length < 2 || board.length < 3) {
    return { score: 0, category: 0, name: "Sin evaluar", cards: [], holeUsed: [], boardUsed: [] };
  }
  let best: HandScore | null = null;
  for (const h of combinations(hole, 2)) {
    for (const b of combinations(board, 3)) {
      const score = evaluate5([...h, ...b]);
      if (!best || score.score > best.score) {
        best = { ...score, holeUsed: h.slice(), boardUsed: b.slice() };
      }
    }
  }
  return best!;
}

const RANK_SINGULAR: Record<number, string> = {
  14: "as",
  13: "rey",
  12: "reina",
  11: "jota",
  10: "diez",
  9: "nueve",
  8: "ocho",
  7: "siete",
  6: "seis",
  5: "cinco",
  4: "cuatro",
  3: "tres",
  2: "dos",
};

const RANK_PLURAL: Record<number, string> = {
  14: "ases",
  13: "reyes",
  12: "reinas",
  11: "jotas",
  10: "dieces",
  9: "nueves",
  8: "ochos",
  7: "sietes",
  6: "seises",
  5: "cincos",
  4: "cuatros",
  3: "treses",
  2: "doses",
};

const one = (rank: number) => RANK_SINGULAR[rank] ?? String(rank);
const many = (rank: number) => RANK_PLURAL[rank] ?? String(rank);

/**
 * Nombre detallado de la mano: "color al as", "full de reyes con dieces",
 * "escalera al diez", etc. (en lugar de sólo "Color").
 */
export function handTitle(result: HandScore): string {
  if (!result.cards.length) return result.name;
  const ranks = result.cards.map(rankOf).sort((a, b) => b - a);
  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  const grouped = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const high = ranks[0]!;

  const straightHighRank = () => {
    const unique = [...new Set(ranks)];
    // A-2-3-4-5 cuenta como escalera al cinco.
    if (unique.includes(14) && unique.includes(5) && unique.includes(2)) return 5;
    return high;
  };

  switch (result.category) {
    case 8:
      return straightHighRank() === 14 ? "escalera real" : `escalera de color al ${one(straightHighRank())}`;
    case 7:
      return `póker de ${many(grouped[0]![0])}`;
    case 6:
      return `full de ${many(grouped[0]![0])} con ${many(grouped[1]![0])}`;
    case 5:
      return `color al ${one(high)}`;
    case 4:
      return `escalera al ${one(straightHighRank())}`;
    case 3:
      return `trío de ${many(grouped[0]![0])}`;
    case 2: {
      const pairs = grouped.filter(([, c]) => c === 2).map(([r]) => r);
      return `doble par de ${many(pairs[0]!)} y ${many(pairs[1]!)}`;
    }
    case 1:
      return `par de ${many(grouped[0]![0])}`;
    default:
      return `carta alta ${one(high)}`;
  }
}

/** Short Spanish explanation of an Omaha showdown result (2 propias + 3 comunitarias). */
export function describeOmaha(result: HandScore): string {
  if (!result.holeUsed.length) return "Mano sin evaluar";
  const fmt = (cards: Card[]) => cards.map((c) => `${cardLabel(c)}${SUIT_SYMBOL[suitOf(c)]}`).join(" ");
  const title = handTitle(result);
  return `${title.charAt(0).toUpperCase()}${title.slice(1)}: usa ${fmt(result.holeUsed)} de su mano + ${fmt(result.boardUsed)} de la mesa`;
}


