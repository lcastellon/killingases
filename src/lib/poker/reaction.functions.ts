import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isTableReactionKey, type TableReactionEvent, type TableReactionKey } from "./reactions";

const REACTION_DURATION_MS = 4_000;
const REACTION_COOLDOWN_MS = 1_500;

type ReactionRow = {
  id: string;
  table_id: string;
  user_id: string;
  seat: number;
  reaction: string;
  created_at: string;
  expires_at: string;
};

function normalizeCode(input: unknown): string {
  return String(input ?? "")
    .trim()
    .toUpperCase();
}

function validateReaction(input: unknown): TableReactionKey {
  if (!isTableReactionKey(input)) throw new Error("Esa reacción no está disponible");
  return input;
}

function toReaction(row: ReactionRow): TableReactionEvent {
  if (!isTableReactionKey(row.reaction)) throw new Error("Reacción desconocida");
  return {
    id: row.id,
    tableId: row.table_id,
    userId: row.user_id,
    seat: row.seat,
    reaction: row.reaction,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

export const listActiveTableReactions = createServerFn({ method: "POST" })
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
    if (!member) throw new Error("Debes unirte a la mesa para ver las reacciones");

    const { data: rows, error } = await db
      .from("table_reactions")
      .select("id, table_id, user_id, seat, reaction, created_at, expires_at")
      .eq("table_id", table.id)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(30);
    if (error) throw new Error(error.message);
    return ((rows ?? []) as ReactionRow[]).map(toReaction);
  });

export const sendTableReaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string; reaction: TableReactionKey }) => ({
    code: normalizeCode(input.code),
    reaction: validateReaction(input.reaction),
  }))
  .handler(async ({ data, context }) => {
    const { admin, getTableByCode, touchTableActivity } = await import("./table.server");
    const db = await admin();
    const table = await getTableByCode(db, data.code);
    if (table.status === "closed") throw new Error("Esta mesa ya está cerrada");

    const { data: member, error: memberError } = await db
      .from("table_players")
      .select("seat")
      .eq("table_id", table.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (memberError) throw new Error(memberError.message);
    if (!member || member.seat === null) {
      throw new Error("Debes estar sentado para enviar una reacción");
    }

    const { data: latest, error: latestError } = await db
      .from("table_reactions")
      .select("created_at")
      .eq("table_id", table.id)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError) throw new Error(latestError.message);
    if (latest && Date.now() - new Date(latest.created_at).getTime() < REACTION_COOLDOWN_MS) {
      throw new Error("Espera un momento antes de reaccionar otra vez");
    }

    await db.from("table_reactions").delete().lt("expires_at", new Date().toISOString());
    await touchTableActivity(db, table.id);
    const now = Date.now();
    const { data: row, error } = await db
      .from("table_reactions")
      .insert({
        table_id: table.id,
        user_id: context.userId,
        seat: member.seat,
        reaction: data.reaction,
        expires_at: new Date(now + REACTION_DURATION_MS).toISOString(),
      })
      .select("id, table_id, user_id, seat, reaction, created_at, expires_at")
      .single();
    if (error) throw new Error(error.message);
    return toReaction(row as ReactionRow);
  });
