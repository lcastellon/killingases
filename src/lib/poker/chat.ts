export const TABLE_CHAT_MAX_LENGTH = 280;

export function normalizeChatMessage(input: unknown): string {
  return String(input ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function validateChatMessage(input: unknown): string {
  const body = normalizeChatMessage(input);
  if (!body) throw new Error("Escribe un mensaje");
  if (body.length > TABLE_CHAT_MAX_LENGTH) {
    throw new Error(`El mensaje no puede superar ${TABLE_CHAT_MAX_LENGTH} caracteres`);
  }
  return body;
}
