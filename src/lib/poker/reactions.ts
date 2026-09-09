export const TABLE_REACTIONS = [
  { key: "thumbs_up", emoji: "👍", label: "Bien jugado" },
  { key: "laugh", emoji: "😂", label: "Risa" },
  { key: "shock", emoji: "😱", label: "Sorpresa" },
  { key: "fire", emoji: "🔥", label: "Fuego" },
  { key: "clap", emoji: "👏", label: "Aplausos" },
  { key: "angry", emoji: "😡", label: "Enojo" },
] as const;

export type TableReactionKey = (typeof TABLE_REACTIONS)[number]["key"];

export type TableReactionEvent = {
  id: string;
  tableId: string;
  userId: string;
  seat: number;
  reaction: TableReactionKey;
  createdAt: string;
  expiresAt: string;
};

export function isTableReactionKey(value: unknown): value is TableReactionKey {
  return TABLE_REACTIONS.some((item) => item.key === value);
}

export function tableReactionDetails(key: TableReactionKey) {
  return TABLE_REACTIONS.find((item) => item.key === key)!;
}
