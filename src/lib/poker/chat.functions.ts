import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateChatMessage } from "./chat";

export type TableChatMessage = {
  id: string;
  tableId: string;
  userId: string;
  displayName: string;
  body: string;
  createdAt: string;
};

type MessageRow = {
  id: string;
  table_id: string;
  user_id: string;
  display_name: string;
  body: string;
  created_at: string;
};

function normalizeCode(input: unknown): string {
  return String(input ?? "")
    .trim()
    .toUpperCase();
}

function toMessage(row: MessageRow): TableChatMessage {
  return {
    id: row.id,
    tableId: row.table_id,
    userId: row.user_id,
    displayName: row.display_name,
    body: row.body,
    createdAt: row.created_at,
  };
}

export const listTableMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => ({ code: normalizeCode(input.code) }))
  .handler(async ({ data, context }) => {
    const { admin, getTableByCode } = await import("./table.server");
    const db = await admin();
    const table = await getTableByCode(db, data.code);
    const { data: member, error: memberError } = await db
      .from("table_players")
      .select("id")
      .eq("table_id", table.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (memberError) throw new Error(memberError.message);
    if (!member) throw new Error("Debes unirte a la mesa para abrir el chat");

    const { data: rows, error } = await db
      .from("table_messages")
      .select("id, table_id, user_id, display_name, body, created_at")
      .eq("table_id", table.id)
      .order("created_at", { ascending: false })
      .limit(80);
    if (error) throw new Error(error.message);
    return ((rows ?? []) as MessageRow[]).reverse().map(toMessage);
  });

export const sendTableMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string; body: string }) => ({
    code: normalizeCode(input.code),
    body: validateChatMessage(input.body),
  }))
  .handler(async ({ data, context }) => {
    const { admin, getTableByCode, touchTableActivity } = await import("./table.server");
    const db = await admin();
    const table = await getTableByCode(db, data.code);
    if (table.status === "closed") throw new Error("Esta mesa ya está cerrada");

    const { data: member, error: memberError } = await db
      .from("table_players")
      .select("display_name")
      .eq("table_id", table.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (memberError) throw new Error(memberError.message);
    if (!member) throw new Error("Debes unirte a la mesa para escribir en el chat");

    await touchTableActivity(db, table.id);
    const { data: row, error } = await db
      .from("table_messages")
      .insert({
        table_id: table.id,
        user_id: context.userId,
        display_name: member.display_name,
        body: data.body,
      })
      .select("id, table_id, user_id, display_name, body, created_at")
      .single();
    if (error) throw new Error(error.message);
    return toMessage(row as MessageRow);
  });
