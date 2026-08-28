import type { Json } from "@/integrations/supabase/types";
import {
  applyAction,
  sanitize,
  settleTimeouts,
  startHand,
  type ActionKind,
  type GameVariant,
  type HandState,
  type SpecialRules,
} from "./engine";

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
  turn_seconds: number;
  game_variant: string;
  special_rules: Record<string, unknown> | null;
  min_buyin: number;
  max_buyin: number;
};

export type PlayerRow = {
  id: string;
  table_id: string;
  user_id: string;
  seat: number | null;
  display_name: string;
  chips: number;
  sitting_out: boolean;
  last_seen_at: string;
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
    .order("seat", { nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as PlayerRow[];
}

export function firstFreeSeat(players: PlayerRow[]): number {
  const taken = new Set(players.map((p) => p.seat).filter((s): s is number => s !== null));
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

/** True while a hand exists and is not finished yet. */
export async function handInProgress(db: AdminClient, tableId: string): Promise<boolean> {
  const latest = await loadLatestHand(db, tableId);
  if (!latest) return false;
  const state = latest.public_state as unknown as HandState;
  return !state.complete;
}

/**
 * Seats anyone who reached the minimum buy-in and un-seats anyone who fell
 * below it. Only runs between hands so live bets are never disturbed.
 */
export async function reconcileSeats(db: AdminClient, table: TableRow) {
  if (await handInProgress(db, table.id)) return;
  const players = await getPlayers(db, table.id);

  for (const p of players) {
    if (p.seat !== null && p.chips < table.min_buyin) {
      const { error } = await db.from("table_players").update({ seat: null }).eq("id", p.id);
      if (error) throw new Error(error.message);
      p.seat = null;
    }
  }

  for (const p of players) {
    if (p.seat === null && p.chips >= table.min_buyin) {
      const seat = firstFreeSeat(players);
      const { error } = await db.from("table_players").update({ seat }).eq("id", p.id);
      if (error) throw new Error(error.message);
      p.seat = seat;
    }
  }
}

/** Saldo del banco global del club para un jugador. */
export async function getBank(db: AdminClient, userId: string): Promise<number> {
  const { data, error } = await db
    .from("profiles")
    .select("bank_chips")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { bank_chips: number } | null)?.bank_chips ?? 0;
}

async function setBank(db: AdminClient, userId: string, value: number) {
  const { error } = await db.from("profiles").update({ bank_chips: value }).eq("id", userId);
  if (error) throw new Error(error.message);
}

/**
 * A player decides their own buy-in, within the table's min/max. The chips come
 * out of their global club bank and `reconcileSeats` seats them between hands.
 */
export async function buyIn(
  db: AdminClient,
  table: TableRow,
  userId: string,
  amount: number,
  seat?: number | null,
) {
  const wanted = Math.trunc(Number(amount));
  if (!Number.isFinite(wanted) || wanted <= 0) throw new Error("Cantidad inválida");

  const players = await getPlayers(db, table.id);
  const me = players.find((p) => p.user_id === userId);
  if (!me) throw new Error("Primero entra a la mesa");

  const bank = await getBank(db, userId);
  if (wanted > bank)
    throw new Error(
      `Tu banco tiene ${bank.toLocaleString("es-MX")} fichas; pide fichas al anfitrión`,
    );

  const total = me.chips + wanted;
  if (total < table.min_buyin)
    throw new Error(`La compra mínima es ${table.min_buyin.toLocaleString("es-MX")}`);
  if (total > table.max_buyin)
    throw new Error(`La compra máxima es ${table.max_buyin.toLocaleString("es-MX")}`);

  const patch: { chips: number; seat?: number } = { chips: total };

  if (seat !== undefined && seat !== null && me.seat === null) {
    const wantedSeat = Math.trunc(Number(seat));
    if (!Number.isInteger(wantedSeat) || wantedSeat < 0 || wantedSeat >= MAX_SEATS)
      throw new Error("Ese asiento no existe");
    if (players.some((p) => p.seat === wantedSeat)) throw new Error("Ese asiento ya está ocupado");
    if (await handInProgress(db, table.id))
      throw new Error("Espera a que termine la mano para sentarte");
    patch.seat = wantedSeat;
  }

  await setBank(db, userId, bank - wanted);
  const { error } = await db.from("table_players").update(patch).eq("id", me.id);
  if (error) {
    // Revertimos el cargo al banco si no pudimos acreditar las fichas en la mesa.
    await setBank(db, userId, bank);
    throw new Error(error.message);
  }

  await reconcileSeats(db, table);
  return { chips: total, bankChips: bank - wanted };
}

/** Devuelve al banco las fichas que un jugador tiene en la mesa y libera su asiento. */
export async function cashOut(db: AdminClient, table: TableRow, userId: string) {
  if (await handInProgress(db, table.id))
    throw new Error("Espera a que termine la mano en curso para retirar tus fichas");

  const players = await getPlayers(db, table.id);
  const me = players.find((p) => p.user_id === userId);
  if (!me) return { chips: 0, bankChips: await getBank(db, userId) };

  const bank = await getBank(db, userId);
  if (me.chips > 0) {
    const { error } = await db
      .from("table_players")
      .update({ chips: 0, seat: null })
      .eq("id", me.id);
    if (error) throw new Error(error.message);
    await setBank(db, userId, bank + me.chips);
    return { chips: 0, bankChips: bank + me.chips };
  }
  if (me.seat !== null) {
    const { error } = await db.from("table_players").update({ seat: null }).eq("id", me.id);
    if (error) throw new Error(error.message);
  }
  return { chips: 0, bankChips: bank };
}

/** Devuelve al banco las fichas de todos los jugadores de una mesa (al cerrarla). */
export async function cashOutTable(db: AdminClient, table: TableRow) {
  const players = await getPlayers(db, table.id);
  for (const p of players) {
    if (p.chips <= 0) continue;
    const bank = await getBank(db, p.user_id);
    const { error } = await db
      .from("table_players")
      .update({ chips: 0, seat: null })
      .eq("id", p.id);
    if (error) throw new Error(error.message);
    await setBank(db, p.user_id, bank + p.chips);
  }
}



/** Tables the host has open, for the permanent lobby list. */
export async function listHostTables(db: AdminClient, hostId: string) {
  const { data, error } = await db
    .from("poker_tables")
    .select("id, code, name, status, small_blind, big_blind, min_buyin, max_buyin, hand_no, created_at")
    .eq("host_id", hostId)
    .neq("status", "closed")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const tables = data ?? [];

  const counts = new Map<string, number>();
  if (tables.length > 0) {
    const { data: rows, error: playersError } = await db
      .from("table_players")
      .select("table_id")
      .in(
        "table_id",
        tables.map((t) => t.id),
      );
    if (playersError) throw new Error(playersError.message);
    for (const row of rows ?? []) counts.set(row.table_id, (counts.get(row.table_id) ?? 0) + 1);
  }

  return tables.map((t) => ({
    code: t.code,
    name: t.name,
    status: t.status,
    smallBlind: t.small_blind,
    bigBlind: t.big_blind,
    minBuyin: t.min_buyin,
    maxBuyin: t.max_buyin,
    handNo: t.hand_no,
    players: counts.get(t.id) ?? 0,
  }));
}

/**
 * Recarga en mesa: el jugador completa su stack hasta el objetivo de la mesa
 * tomando las fichas de su banco global (nunca se crean fichas).
 */
export async function rebuyChips(db: AdminClient, table: TableRow, userId: string) {
  if (await handInProgress(db, table.id))
    throw new Error("Espera a que termine la mano en curso para recargar fichas");

  const players = await getPlayers(db, table.id);
  const me = players.find((p) => p.user_id === userId);
  if (!me) throw new Error("Primero entra a la mesa");

  const target = Math.min(table.max_buyin, Math.max(table.min_buyin, table.starting_chips));
  if (me.chips >= target) throw new Error("Todavía tienes fichas suficientes para jugar");

  const bank = await getBank(db, userId);
  const needed = target - me.chips;
  const take = Math.min(bank, needed);
  if (take <= 0)
    throw new Error("Tu banco está en 0; pide fichas al anfitrión");
  const next = me.chips + take;
  if (next < table.min_buyin)
    throw new Error(
      `Necesitas al menos ${table.min_buyin.toLocaleString("es-MX")} y tu banco tiene ${bank.toLocaleString("es-MX")}`,
    );

  await setBank(db, userId, bank - take);
  const { error } = await db.from("table_players").update({ chips: next }).eq("id", me.id);
  if (error) {
    await setBank(db, userId, bank);
    throw new Error(error.message);
  }

  await reconcileSeats(db, table);
  return { chips: next, bankChips: bank - take };
}

/** El anfitrión devuelve al banco las fichas de todos los de la mesa. */
export async function resetTableStacks(db: AdminClient, table: TableRow, hostId: string) {
  if (table.host_id !== hostId) throw new Error("Solo el anfitrión puede reiniciar la mesa");
  if (await handInProgress(db, table.id))
    throw new Error("Espera a que termine la mano en curso para reiniciar la mesa");

  await cashOutTable(db, table);
  return { ok: true };
}

/** Banco global del club: el anfitrión agrega o retira fichas a un jugador. */
export async function adjustPlayerBank(
  db: AdminClient,
  hostId: string,
  targetUserId: string,
  delta: number,
) {
  void hostId; // el llamador ya validó que es el anfitrión del club
  if (!Number.isFinite(delta) || Math.trunc(delta) === 0) throw new Error("Cantidad inválida");

  const bank = await getBank(db, targetUserId);
  const next = bank + Math.trunc(delta);
  if (next < 0) throw new Error("El jugador no tiene tantas fichas en su banco");

  await setBank(db, targetUserId, next);
  return { bankChips: next };
}


export async function dealNewHand(db: AdminClient, table: TableRow, userId: string) {
  if (table.host_id !== userId) throw new Error("Solo el anfitrión puede repartir");
  await reconcileSeats(db, table);
  const players = await getPlayers(db, table.id);
  const seated = players.filter(
    (p): p is PlayerRow & { seat: number } =>
      p.seat !== null && !p.sitting_out && p.chips >= table.min_buyin,
  );
  if (seated.length < 2)
    throw new Error("Se necesitan al menos 2 jugadores con la compra mínima de fichas");

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
    variant: (table.game_variant as GameVariant) ?? "omaha",
    specialRules: (table.special_rules ?? {}) as SpecialRules,
    turnSeconds: table.turn_seconds,
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

  // The turn clock is authoritative on the server: resolve expired turns first.
  if (settleTimeouts(state)) {
    await persistHand(db, latest.id, state);
    await syncChips(db, table.id, state);
    if (state.complete) throw new Error("Se te acabó el tiempo y la mano avanzó");
  }

  const me = state.players.find((p) => p.userId === userId);
  if (!me) throw new Error("No estás en esta mano");
  if (state.currentSeat !== me.seat) throw new Error("No es tu turno");

  const next = applyAction(state, me.seat, action, amount);
  await persistHand(db, latest.id, next);
  await syncChips(db, table.id, next);
  return { complete: next.complete };
}

/** Touch presence so the table can tell who is still connected. */
export async function touchPresence(db: AdminClient, tableId: string, userId: string) {
  await db
    .from("table_players")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("table_id", tableId)
    .eq("user_id", userId);
}

/**
 * Applies any expired turn clocks on the current hand. Called from reads and
 * writes so the hand never stalls on a disconnected player.
 */
export async function enforceTurnTimer(db: AdminClient, table: TableRow) {
  const latest = await loadLatestHand(db, table.id);
  if (!latest) return false;
  const publicState = latest.public_state as unknown as HandState;
  if (publicState.complete || !publicState.turnEndsAt) return false;
  if (Date.now() < Date.parse(publicState.turnEndsAt)) return false;

  const state = await loadSecret(db, latest.id);
  if (!settleTimeouts(state)) return false;
  await persistHand(db, latest.id, state);
  await syncChips(db, table.id, state);
  return true;
}

/**
 * Global host panel data: every registered player of the club plus the tables
 * they are sitting at (with chip counts) across all of the host's open tables.
 */
export async function hostPanelData(db: AdminClient, hostId: string) {
  const { data: tableRows, error: tablesError } = await db
    .from("poker_tables")
    .select("id, code, name, status, min_buyin, max_buyin, small_blind, big_blind")
    .eq("host_id", hostId)
    .neq("status", "closed")
    .order("created_at", { ascending: false });
  if (tablesError) throw new Error(tablesError.message);
  const tables = tableRows ?? [];

  const { data: profileRows, error: profilesError } = await db
    .from("profiles")
    .select("id, display_name, created_at, bank_chips")
    .order("created_at", { ascending: true });
  if (profilesError) throw new Error(profilesError.message);

  let seats: { table_id: string; user_id: string; chips: number; seat: number | null }[] = [];
  if (tables.length > 0) {
    const { data: seatRows, error: seatsError } = await db
      .from("table_players")
      .select("table_id, user_id, chips, seat")
      .in(
        "table_id",
        tables.map((t) => t.id),
      );
    if (seatsError) throw new Error(seatsError.message);
    seats = seatRows ?? [];
  }

  const byId = new Map(tables.map((t) => [t.id, t]));

  return {
    tables: tables.map((t) => ({
      code: t.code,
      name: t.name,
      minBuyin: t.min_buyin,
      maxBuyin: t.max_buyin,
      smallBlind: t.small_blind,
      bigBlind: t.big_blind,
    })),
    players: (profileRows ?? []).map((p) => ({
      userId: p.id,
      displayName: p.display_name,
      joinedAt: p.created_at,
      bankChips: (p as { bank_chips?: number }).bank_chips ?? 0,
      memberships: seats
        .filter((s) => s.user_id === p.id)
        .map((s) => ({
          code: byId.get(s.table_id)?.code ?? "",
          name: byId.get(s.table_id)?.name ?? "",
          chips: s.chips,
          seat: s.seat,
          maxBuyin: byId.get(s.table_id)?.max_buyin ?? 0,
        }))
        .filter((m) => m.code !== ""),
    })),
  };
}


export type ProfilePrefs = {
  displayName: string;
  avatarPath: string | null;
  feltTheme: string;
};

/** Firma URLs temporales para los avatares (bucket privado). */
export async function avatarUrlsFor(
  db: AdminClient,
  userIds: string[],
): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  if (userIds.length === 0) return out;
  const { data } = await db.from("profiles").select("id, avatar_path").in("id", userIds);
  for (const row of data ?? []) {
    const path = (row as { avatar_path: string | null }).avatar_path;
    if (!path) {
      out[row.id] = null;
      continue;
    }
    const signed = await db.storage.from("avatars").createSignedUrl(path, 60 * 60);
    out[row.id] = signed.data?.signedUrl ?? null;
  }
  return out;
}

export async function profilePrefs(db: AdminClient, userId: string): Promise<ProfilePrefs> {
  const { data } = await db
    .from("profiles")
    .select("display_name, avatar_path, felt_theme")
    .eq("id", userId)
    .maybeSingle();
  const row = data as
    | { display_name: string; avatar_path: string | null; felt_theme: string | null }
    | null;
  return {
    displayName: row?.display_name ?? "Jugador",
    avatarPath: row?.avatar_path ?? null,
    feltTheme: row?.felt_theme ?? "esmeralda",
  };
}

export async function saveProfilePrefs(
  db: AdminClient,
  userId: string,
  patch: { displayName?: string; avatarPath?: string | null; feltTheme?: string },
) {
  const update: { display_name?: string; avatar_path?: string | null; felt_theme?: string } = {};
  if (patch.displayName !== undefined) update.display_name = patch.displayName;
  if (patch.avatarPath !== undefined) update.avatar_path = patch.avatarPath;
  if (patch.feltTheme !== undefined) update.felt_theme = patch.feltTheme;
  if (Object.keys(update).length === 0) return;
  const { error } = await db.from("profiles").update(update).eq("id", userId);
  if (error) throw new Error(error.message);
  if (patch.displayName !== undefined) {
    await db
      .from("table_players")
      .update({ display_name: patch.displayName })
      .eq("user_id", userId);
  }
}
