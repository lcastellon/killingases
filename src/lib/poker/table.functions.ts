import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PublicHandState, SpecialRules } from "./engine";

export type TableSnapshot = {
  table: {
    id: string;
    code: string;
    name: string;
    hostId: string;
    smallBlind: number;
    bigBlind: number;
    startingChips: number;
    status: string;
    buttonSeat: number | null;
    handNo: number;
    turnSeconds: number;
    gameVariant: string;
    specialRules: SpecialRules;
    minBuyin: number;
    maxBuyin: number;
  };
  players: {
    userId: string;
    seat: number | null;
    displayName: string;
    chips: number;
    sittingOut: boolean;
    lastSeenAt: string;
    online: boolean;
  }[];
  hand: PublicHandState | null;
  myCards: string[] | null;
  me: {
    userId: string;
    seat: number | null;
    isHost: boolean;
    chips: number;
    isSpectator: boolean;
  };
  serverNow: string;
};


export const createTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      name?: string;
      smallBlind?: number;
      bigBlind?: number;
      startingChips?: number;
      turnSeconds?: number;
      minBuyin?: number;
      maxBuyin?: number;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { admin, makeCode, displayNameFor } = await import("./table.server");
    const db = await admin();
    const bigBlind = Math.max(2, Math.floor(data.bigBlind ?? 50));
    const smallBlind = Math.max(1, Math.floor(data.smallBlind ?? Math.floor(bigBlind / 2)));
    const startingChips = Math.max(bigBlind * 10, Math.floor(data.startingChips ?? 5000));
    const turnSeconds = Math.min(120, Math.max(10, Math.floor(data.turnSeconds ?? 30)));
    const minBuyin = Math.max(bigBlind * 2, Math.floor(data.minBuyin ?? bigBlind * 20));
    const maxBuyin = Math.max(minBuyin, Math.floor(data.maxBuyin ?? minBuyin * 10));

    let code = makeCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: existing } = await db
        .from("poker_tables")
        .select("id")
        .eq("code", code)
        .maybeSingle();
      if (!existing) break;
      code = makeCode();
    }

    const { data: table, error } = await db
      .from("poker_tables")
      .insert({
        code,
        name: data.name?.trim() || "Mesa Mata Ases",
        host_id: context.userId,
        small_blind: smallBlind,
        big_blind: bigBlind,
        starting_chips: startingChips,
        turn_seconds: turnSeconds,
        game_variant: "omaha",
        special_rules: {},
        min_buyin: minBuyin,
        max_buyin: maxBuyin,
      })
      .select("id, code")
      .single();
    if (error) throw new Error(error.message);

    const displayName = await displayNameFor(db, context.userId);
    const hostChips = Math.min(maxBuyin, Math.max(minBuyin, startingChips));
    const { error: seatError } = await db.from("table_players").insert({
      table_id: table.id,
      user_id: context.userId,
      seat: 0,
      display_name: displayName,
      chips: hostChips,
    });
    if (seatError) throw new Error(seatError.message);

    return { code: table.code };
  });

export const joinTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => ({ code: String(input.code ?? "").trim().toUpperCase() }))
  .handler(async ({ data, context }) => {
    const { admin, getTableByCode, getPlayers, displayNameFor } = await import("./table.server");
    const db = await admin();
    const table = await getTableByCode(db, data.code);
    const players = await getPlayers(db, table.id);
    const mine = players.find((p) => p.user_id === context.userId);
    if (mine) return { code: table.code };

    // New players enter as spectators with 0 chips; only the host hands out chips.
    const displayName = await displayNameFor(db, context.userId);
    const { error } = await db.from("table_players").insert({
      table_id: table.id,
      user_id: context.userId,
      seat: null,
      display_name: displayName,
      chips: 0,
    });
    if (error) throw new Error(error.message);
    return { code: table.code };
  });

export const setPlayerChips = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string; userId: string; delta: number }) => ({
    code: String(input.code ?? "").trim().toUpperCase(),
    userId: String(input.userId ?? ""),
    delta: Math.trunc(Number(input.delta ?? 0)),
  }))
  .handler(async ({ data, context }) => {
    const { admin, getTableByCode, adjustPlayerChips } = await import("./table.server");
    const db = await admin();
    const table = await getTableByCode(db, data.code);
    return adjustPlayerChips(db, table, context.userId, data.userId, data.delta);
  });


export const leaveTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => ({ code: String(input.code ?? "").trim().toUpperCase() }))
  .handler(async ({ data, context }) => {
    const { admin, getTableByCode } = await import("./table.server");
    const db = await admin();
    const table = await getTableByCode(db, data.code);
    const { error } = await db
      .from("table_players")
      .delete()
      .eq("table_id", table.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getTableSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => ({ code: String(input.code ?? "").trim().toUpperCase() }))
  .handler(async ({ data, context }): Promise<TableSnapshot> => {
    const { admin, getTableByCode, getPlayers, enforceTurnTimer, touchPresence } = await import(
      "./table.server"
    );
    const db = await admin();
    const table = await getTableByCode(db, data.code);
    await enforceTurnTimer(db, table);
    await touchPresence(db, table.id, context.userId);
    const players = await getPlayers(db, table.id);

    const { data: handRow } = await db
      .from("hands")
      .select("id, public_state")
      .eq("table_id", table.id)
      .order("hand_no", { ascending: false })
      .limit(1)
      .maybeSingle();

    let myCards: string[] | null = null;
    if (handRow) {
      const { data: cardRow } = await db
        .from("hand_cards")
        .select("cards")
        .eq("hand_id", handRow.id)
        .eq("user_id", context.userId)
        .maybeSingle();
      myCards = (cardRow?.cards as string[] | undefined) ?? null;
    }

    const mine = players.find((p) => p.user_id === context.userId);

    return {
      table: {
        id: table.id,
        code: table.code,
        name: table.name,
        hostId: table.host_id,
        smallBlind: table.small_blind,
        bigBlind: table.big_blind,
        startingChips: table.starting_chips,
        status: table.status,
        buttonSeat: table.button_seat,
        handNo: table.hand_no,
        turnSeconds: table.turn_seconds,
        gameVariant: table.game_variant,
        specialRules: (table.special_rules ?? {}) as SpecialRules,
      },
      players: players.map((p) => ({
        userId: p.user_id,
        seat: p.seat,
        displayName: p.display_name,
        chips: p.chips,
        sittingOut: p.sitting_out,
        lastSeenAt: p.last_seen_at,
        online: Date.now() - Date.parse(p.last_seen_at) < 20_000,
      })),
      hand: (handRow?.public_state as unknown as PublicHandState) ?? null,
      myCards,
      me: {
        userId: context.userId,
        seat: mine?.seat ?? null,
        isHost: table.host_id === context.userId,
      },
      serverNow: new Date().toISOString(),
    };
  });

export const dealHand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => ({ code: String(input.code ?? "").trim().toUpperCase() }))
  .handler(async ({ data, context }) => {
    const { admin, getTableByCode, dealNewHand } = await import("./table.server");
    const db = await admin();
    const table = await getTableByCode(db, data.code);
    return dealNewHand(db, table, context.userId);
  });

export const act = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string; action: "fold" | "check" | "call" | "raise"; amount?: number | undefined }) => ({
    code: String(input.code ?? "").trim().toUpperCase(),
    action: input.action,
    amount: input.amount,
  }))
  .handler(async ({ data, context }) => {
    const { admin, getTableByCode, performAction } = await import("./table.server");
    const db = await admin();
    const table = await getTableByCode(db, data.code);
    return performAction(db, table, context.userId, data.action, data.amount);
  });
