import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PublicHandState, SpecialRules } from "./engine";
import { assertHostClaims, isHostEmail } from "./host";

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
    avatarUrl: string | null;
  }[];
  hand: PublicHandState | null;
  myCards: string[] | null;
  me: {
    userId: string;
    seat: number | null;
    isHost: boolean;
    chips: number;
    isSpectator: boolean;
    displayName: string;
    avatarUrl: string | null;
    feltTheme: string;
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
    assertHostClaims(context.claims);
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

    // The host joins as a spectator too and picks their own buy-in like everyone else.
    const displayName = await displayNameFor(db, context.userId);
    const { error: seatError } = await db.from("table_players").insert({
      table_id: table.id,
      user_id: context.userId,
      seat: null,
      display_name: displayName,
      chips: 0,
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
    if (table.status === "closed") throw new Error("Esa mesa ya fue cerrada por el anfitrión");
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

export const buyInTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string; amount: number; seat?: number | null }) => ({
    code: String(input.code ?? "").trim().toUpperCase(),
    amount: Math.trunc(Number(input.amount ?? 0)),
    seat: input.seat === undefined || input.seat === null ? null : Math.trunc(Number(input.seat)),
  }))
  .handler(async ({ data, context }) => {
    const { admin, getTableByCode, buyIn } = await import("./table.server");
    const db = await admin();
    const table = await getTableByCode(db, data.code);
    return buyIn(db, table, context.userId, data.amount, data.seat);
  });


export const rebuyTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => ({
    code: String(input.code ?? "").trim().toUpperCase(),
  }))
  .handler(async ({ data, context }) => {
    const { admin, getTableByCode, rebuyChips } = await import("./table.server");
    const db = await admin();
    const table = await getTableByCode(db, data.code);
    return rebuyChips(db, table, context.userId);
  });

export const resetTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => ({
    code: String(input.code ?? "").trim().toUpperCase(),
  }))
  .handler(async ({ data, context }) => {
    assertHostClaims(context.claims);
    const { admin, getTableByCode, resetTableStacks } = await import("./table.server");
    const db = await admin();
    const table = await getTableByCode(db, data.code);
    return resetTableStacks(db, table, context.userId);
  });

export const listMyTables = createServerFn({ method: "POST" })

  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!isHostEmail(context.claims.email as string | undefined)) return [];
    const { admin, listHostTables } = await import("./table.server");
    const db = await admin();
    return listHostTables(db, context.userId);
  });

export const closeTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => ({ code: String(input.code ?? "").trim().toUpperCase() }))
  .handler(async ({ data, context }) => {
    assertHostClaims(context.claims);
    const { admin, getTableByCode } = await import("./table.server");
    const db = await admin();
    const table = await getTableByCode(db, data.code);
    if (table.host_id !== context.userId) throw new Error("Esa mesa no es tuya");
    const { error } = await db
      .from("poker_tables")
      .update({ status: "closed", updated_at: new Date().toISOString() })
      .eq("id", table.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setPlayerChips = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string; userId: string; delta: number }) => ({
    code: String(input.code ?? "").trim().toUpperCase(),
    userId: String(input.userId ?? ""),
    delta: Math.trunc(Number(input.delta ?? 0)),
  }))
  .handler(async ({ data, context }) => {
    assertHostClaims(context.claims);
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
    const {
      admin,
      getTableByCode,
      getPlayers,
      enforceTurnTimer,
      touchPresence,
      reconcileSeats,
      avatarUrlsFor,
      profilePrefs,
    } = await import("./table.server");
    const db = await admin();
    const table = await getTableByCode(db, data.code);
    await enforceTurnTimer(db, table);
    await touchPresence(db, table.id, context.userId);
    await reconcileSeats(db, table);
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
    const avatars = await avatarUrlsFor(db, players.map((p) => p.user_id));
    const prefs = await profilePrefs(db, context.userId);

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
        minBuyin: table.min_buyin,
        maxBuyin: table.max_buyin,
      },
      players: players.map((p) => ({
        userId: p.user_id,
        seat: p.seat,
        displayName: p.display_name,
        chips: p.chips,
        sittingOut: p.sitting_out,
        lastSeenAt: p.last_seen_at,
        online: Date.now() - Date.parse(p.last_seen_at) < 20_000,
        avatarUrl: avatars[p.user_id] ?? null,
      })),
      hand: (handRow?.public_state as unknown as PublicHandState) ?? null,
      myCards,
      me: {
        userId: context.userId,
        seat: mine?.seat ?? null,
        isHost:
          table.host_id === context.userId && isHostEmail(context.claims.email as string | undefined),
        chips: mine?.chips ?? 0,
        isSpectator: !mine || mine.seat === null,
        displayName: prefs.displayName,
        avatarUrl: avatars[context.userId] ?? null,
        feltTheme: prefs.feltTheme,
      },

      serverNow: new Date().toISOString(),
    };
  });

export const dealHand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => ({ code: String(input.code ?? "").trim().toUpperCase() }))
  .handler(async ({ data, context }) => {
    assertHostClaims(context.claims);
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

export const getHostPanel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertHostClaims(context.claims);
    const { admin, hostPanelData } = await import("./table.server");
    const db = await admin();
    return hostPanelData(db, context.userId);
  });

export const addPlayerToTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string; userId: string }) => ({
    code: String(input.code ?? "").trim().toUpperCase(),
    userId: String(input.userId ?? ""),
  }))
  .handler(async ({ data, context }) => {
    assertHostClaims(context.claims);
    const { admin, getTableByCode, getPlayers, displayNameFor } = await import("./table.server");
    const db = await admin();
    const table = await getTableByCode(db, data.code);
    if (table.host_id !== context.userId) throw new Error("Esa mesa no es tuya");
    const players = await getPlayers(db, table.id);
    if (players.some((p) => p.user_id === data.userId)) return { ok: true };
    const displayName = await displayNameFor(db, data.userId);
    const { error } = await db.from("table_players").insert({
      table_id: table.id,
      user_id: data.userId,
      seat: null,
      display_name: displayName,
      chips: 0,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { displayName?: string; avatarPath?: string | null; feltTheme?: string }) => input,
  )
  .handler(async ({ data, context }) => {
    const { admin, saveProfilePrefs, profilePrefs } = await import("./table.server");
    const db = await admin();
    const patch: { displayName?: string; avatarPath?: string | null; feltTheme?: string } = {};
    if (data.displayName !== undefined) {
      const name = String(data.displayName).trim().slice(0, 24);
      if (name.length < 2) throw new Error("El nombre debe tener al menos 2 caracteres");
      patch.displayName = name;
    }
    if (data.avatarPath !== undefined) {
      if (data.avatarPath === null) patch.avatarPath = null;
      else {
        const path = String(data.avatarPath);
        if (!path.startsWith(`${context.userId}/`)) throw new Error("Imagen no válida");
        patch.avatarPath = path;
      }
    }
    if (data.feltTheme !== undefined) patch.feltTheme = String(data.feltTheme).slice(0, 24);
    await saveProfilePrefs(db, context.userId, patch);
    return await profilePrefs(db, context.userId);
  });
