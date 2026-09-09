import { describe, expect, it } from "vitest";

import { TABLE_CHAT_MAX_LENGTH, normalizeChatMessage, validateChatMessage } from "./chat";

describe("mensajes del chat de mesa", () => {
  it("normaliza espacios y saltos de línea", () => {
    expect(normalizeChatMessage("  buena\n  mano   amigos ")).toBe("buena mano amigos");
  });

  it("rechaza mensajes vacíos", () => {
    expect(() => validateChatMessage("   \n ")).toThrow("Escribe un mensaje");
  });

  it("acepta el límite y rechaza mensajes más largos", () => {
    expect(validateChatMessage("a".repeat(TABLE_CHAT_MAX_LENGTH))).toHaveLength(
      TABLE_CHAT_MAX_LENGTH,
    );
    expect(() => validateChatMessage("a".repeat(TABLE_CHAT_MAX_LENGTH + 1))).toThrow("superar");
  });
});
