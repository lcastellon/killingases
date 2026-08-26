import type { Json } from "@/integrations/supabase/types";
import { applyAction, sanitize, startHand, type ActionKind, type HandState } from "./engine";

const MAX_SEATS = 9;

export type AdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

export async function admin(): Promise<AdminClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeCode(): string {
  let out = "";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export type TableRow = {
  id: string;
  code: string;
  name: string;
  host_id: string;
  small_blind: number;
  big_blind: number;
  starting_chips: number;
  status: string;
  button_seat: number | null;
  hand_no: number;
};

export type PlayerRow = {
  id: string;
  table_id: string;
  user_id: string;
  seat: number;
  display_name: string;
  chips: number;
  sitting_out: boolean;
};

export async function getTableByCode(db: AdminClient, code: string): Promise<TableRow> {
  const { data, error } = await db
    .from("poker_tables")
    .select("*")
    .eq("code", code.toUpperCase())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No encontramos esa mesa");
  return data as TableRow;
}

export async function getPlayers(db: AdminClient, tableId: string): Promise<PlayerRow[]> {
  const { data, error } = await db
    .from("table_players")
    .select("*")
    .eq("table_id", tableId)
    .order("seat");
  if (error) throw new Error(error.message);
  return (data ?? []) as PlayerRow[];
}

export function firstFreeSeat(players: PlayerRow[]): number {
  const taken = new Set(players.map((p) => p.seat));
  for (let i = 0; i < MAX_SEATS; i++) if (!taken.has(i)) return i;
  throw new Error("La mesa está llena");
}

export async function displayNameFor(db: AdminClient, userId: string): Promise<string> {
  const { data } = await db.from("profiles").select("display_name").eq("id", userId).maybeSingle();
  return data?.display_name ?? "Jugador";
}

async function loadLatestHand(db: AdminClient, tableId: string) {
  const { data, error } = await db
    .from("hands")
    .select("id, hand_no, public_state")
    .eq("table_id", tableId)
    .order("hand_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function loadSecret(db: AdminClient, handId: string): Promise<HandState> {
  const { data, error } = await db
    .from("hand_secrets")
    .select("state")
    .eq("hand_id", handId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Estado de la mano no disponible");
  return data.state as unknown as HandState;
}

async function persistHand(db: AdminClient, handId: string, state: HandState) {
  const publicState = sanitize(state) as unknown as Json;
  const { error } = await db
    .from("hands")
    .update({ public_state: publicState, updated_at: new Date().toISOString() })
    .eq("id", handId);
  if (error) throw new Error(error.message);
  const { error: secretError } = await db
    .from("hand_secrets")
    .update({ state: state as unknown as Json, updated_at: new Date().toISOString() })
    .eq("hand_id", handId);
  if (secretError) throw new Error(secretError.message);

}

async function syncChips(db: AdminClient, tableId: string, state: HandState) {
  for (const p of state.players) {
    const { error } = await db
      .from("table_players")
      .update({ chips: p.chips })
      .eq("table_id", tableId)
      .eq("seat", p.seat);
    if (error) throw new Error(error.message);
  }
}

export async function dealNewHand(db: AdminClient, table: TableRow, userId: string) {
  if (table.host_id !== userId) throw new Error("Solo el anfitrión puede repartir");
  const players = await getPlayers(db, table.id);
  const seated = players.filter((p) => !p.sitting_out && p.chips > 0);
  if (seated.length < 2) throw new Error("Se necesitan al menos 2 jugadores con fichas");

  const latest = await loadLatestHand(db, table.id);
  if (latest) {
    const state = latest.public_state as unknown as HandState;
    if (!state.complete) throw new Error("La mano en curso todavía no ha terminado");
  }

  const seats = seated.map((p) => p.seat).sort((a, b) => a - b);
  const previousButton = table.button_seat;
  let buttonSeat = seats[0]!;
  if (previousButton !== null) {
    buttonSeat = seats.find((s) => s > previousButton) ?? seats[0]!;
  }

  const handNo = table.hand_no + 1;
  const state = startHand({
    handNo,
    buttonSeat,
    smallBlind: table.small_blind,
    bigBlind: table.big_blind,
    seats: seated.map((p) => ({
      seat: p.seat,
      userId: p.user_id,
      name: p.display_name,
      chips: p.chips,
    })),
  });

  const { data: hand, error } = await db
    .from("hands")
    .insert({
      table_id: table.id,
      hand_no: handNo,
      public_state: sanitize(state) as unknown as Json,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { error: secretError } = await db
    .from("hand_secrets")
    .insert({ hand_id: hand.id, state: state as unknown as Json });
  if (secretError) throw new Error(secretError.message);

  const cardRows = state.players.map((p) => ({
    hand_id: hand.id,
    user_id: p.userId,
    seat: p.seat,
    cards: state.hole[String(p.seat)] ?? [],
  }));
  const { error: cardsError } = await db.from("hand_cards").insert(cardRows);
  if (cardsError) throw new Error(cardsError.message);

  const { error: tableError } = await db
    .from("poker_tables")
    .update({
      status: "playing",
      button_seat: buttonSeat,
      hand_no: handNo,
      updated_at: new Date().toISOString(),
    })
    .eq("id", table.id);
  if (tableError) throw new Error(tableError.message);

  await syncChips(db, table.id, state);
  return { handId: hand.id, handNo };
}

export async function performAction(
  db: AdminClient,
  table: TableRow,
  userId: string,
  action: ActionKind,
  amount?: number,
) {
  const latest = await loadLatestHand(db, table.id);
  if (!latest) throw new Error("No hay mano en curso");
  const state = await loadSecret(db, latest.id);
  if (state.complete) throw new Error("La mano ya terminó");

  const me = state.players.find((p) => p.userId === userId);
  if (!me) throw new Error("No estás en esta mano");
  if (state.currentSeat !== me.seat) throw new Error("No es tu turno");

  const next = applyAction(state, me.seat, action, amount);
  await persistHand(db, latest.id, next);
  await syncChips(db, table.id, next);
  return { complete: next.complete };
}
