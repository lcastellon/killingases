import { describe, expect, it } from "vitest";

import { isTableReactionKey, tableReactionDetails, TABLE_REACTIONS } from "./reactions";

describe("reacciones de mesa", () => {
  it("mantiene un catálogo corto de reacciones conocidas", () => {
    expect(TABLE_REACTIONS).toHaveLength(6);
    expect(TABLE_REACTIONS.every((item) => isTableReactionKey(item.key))).toBe(true);
  });

  it("rechaza claves inventadas", () => {
    expect(isTableReactionKey("all_in_free_chips")).toBe(false);
  });

  it("resuelve el emoji visible", () => {
    expect(tableReactionDetails("fire").emoji).toBe("🔥");
  });
});
