import type { Json } from "@/integrations/supabase/types";
import type { HandState, SpecialRules } from "./engine";
import {
  blindLevelAt,
  normalizeTournamentInput,
  type BlindLevel,
  type CreateTournamentInput,
  type PrizePlace,
  type TournamentEntryStatus,
  type TournamentFormat,
  type TournamentStatus,
  type TournamentView,
} from "./tournament";
import {
  displayNameFor,
  getPlayers,
  makeCode,
  type AdminClient,
  type TableRow,
} from "./table.server";

type TournamentRow = {
  id: string;
  table_id: string;
  host_id: string;
  format: TournamentFormat;
  status: TournamentStatus;
  buy_in: number;
  house_fee_percent: number;
  starting_stack: number;
  min_players: number;
  max_players: number;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  allow_rebuys: boolean;
  max_rebuys: number;
  rebuy_until_level: number;
  blind_interval_minutes: number;
  blind_levels: BlindLevel[];
  prize_structure: PrizePlace[];
  current_level: number;
  entries_count: number;
  remaining_players: number;
  prize_pool: number;
  house_fee_total: number;
  started_at: string | null;
  completed_at: string | null;
  winner_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type EntryRow = {
  id: string;
  tournament_id: string;
  user_id: string;
  display_name: string;
  status: TournamentEntryStatus;
  seat: number;
  rebuys: number;
  total_paid: number;
  finish_position: number | null;
  prize_amount: number;
  registered_at: string;
  eliminated_at: string | null;
  paid_at: string | null;
};

export async function getTournamentByTable(
  db: AdminClient,
  tableId: string,
): Promise<TournamentRow | null> {
  const { data, error } = await db
    .from("tournaments")
    .select("*")
    .eq("table_id", tableId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? (data as unknown as TournamentRow) : null;
}

async function getTournamentEntries(db: AdminClient, tournamentId: string): Promise<EntryRow[]> {
  const { data, error } = await db
    .from("tournament_entries")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("seat", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as EntryRow[];
}

export async function createTournamentTable(
  db: AdminClient,
  hostId: string,
  rawInput: CreateTournamentInput,
) {
  const input = normalizeTournamentInput(rawInput);
  const firstLevel = input.blindLevels[0]!;
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

  const rules: SpecialRules = {
    holeCards: input.gameVariant === "omaha5" ? 5 : 4,
    mustUseHole: 2,
    chargeRake: false,
  };
  const defaultName = input.format === "sit_go" ? "Sit & Go Omaha" : "Torneo Omaha";
  const { data: table, error: tableError } = await db
    .from("poker_tables")
    .insert({
      code,
      name: input.name || defaultName,
      host_id: hostId,
      small_blind: firstLevel.smallBlind,
      big_blind: firstLevel.bigBlind,
      starting_chips: input.startingStack,
      turn_seconds: 30,
      game_variant: input.gameVariant ?? "omaha",
      special_rules: rules as unknown as Json,
      is_stable: true,
      min_buyin: 1,
      max_buyin: input.startingStack,
      table_mode: "tournament",
    })
    .select("id, code")
    .single();
  if (tableError) throw new Error(tableError.message);

  const { data: tournament, error: tournamentError } = await db
    .from("tournaments")
    .insert({
      table_id: table.id,
      host_id: hostId,
      format: input.format,
      buy_in: input.buyIn,
      house_fee_percent: input.houseFeePercent ?? 10,
      starting_stack: input.startingStack,
      min_players: input.minPlayers,
      max_players: input.maxPlayers,
      registration_opens_at: input.registrationOpensAt ?? null,
      registration_closes_at: input.registrationClosesAt ?? null,
      allow_rebuys: input.allowRebuys ?? false,
      max_rebuys: input.maxRebuys ?? 0,
      rebuy_until_level: input.rebuyUntilLevel ?? 0,
      blind_interval_minutes: input.blindIntervalMinutes,
      blind_levels: input.blindLevels as unknown as Json,
      prize_structure: input.prizeStructure as unknown as Json,
    })
    .select("id")
    .single();
  if (tournamentError) {
    await db.from("poker_tables").delete().eq("id", table.id);
    throw new Error(tournamentError.message);
  }

  const displayName = await displayNameFor(db, hostId);
  const { error: membershipError } = await db.from("table_players").insert({
    table_id: table.id,
    user_id: hostId,
    seat: null,
    display_name: displayName,
    chips: 0,
  });
  if (membershipError) throw new Error(membershipError.message);
  return { code: table.code, tournamentId: tournament.id };
}

async function startTournament(db: AdminClient, tournament: TournamentRow) {
  if (tournament.status !== "registering") return tournament;
  if (tournament.entries_count < tournament.min_players) {
    throw new Error(`Se necesitan al menos ${tournament.min_players} jugadores inscritos`);
  }
  const now = new Date().toISOString();
  const { data: claimed, error } = await db
    .from("tournaments")
    .update({ status: "running", started_at: now, current_level: 1, updated_at: now })
    .eq("id", tournament.id)
    .eq("status", "registering")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (claimed) {
    const { error: entriesError } = await db
      .from("tournament_entries")
      .update({ status: "active" })
      .eq("tournament_id", tournament.id)
      .eq("status", "registered");
    if (entriesError) throw new Error(entriesError.message);
  }
  return (await getTournamentByTable(db, tournament.table_id))!;
}

async function cancelTournament(db: AdminClient, tournament: TournamentRow) {
  const { error } = await db.rpc("cancel_tournament_if_registering", {
    _tournament_id: tournament.id,
  });
  if (error) throw new Error(error.message);
  return (await getTournamentByTable(db, tournament.table_id))!;
}

async function completeIfReady(db: AdminClient, tournamentId: string) {
  const { error } = await db.rpc("complete_tournament_if_ready", {
    _tournament_id: tournamentId,
  });
  if (error) throw new Error(error.message);
}

export async function syncTournamentState(db: AdminClient, table: TableRow) {
  let tournament = await getTournamentByTable(db, table.id);
  if (!tournament) return null;
  const now = Date.now();

  if (
    tournament.format === "scheduled" &&
    tournament.status === "registering" &&
    tournament.registration_closes_at &&
    now >= Date.parse(tournament.registration_closes_at)
  ) {
    tournament =
      tournament.entries_count >= tournament.min_players
        ? await startTournament(db, tournament)
        : await cancelTournament(db, tournament);
  }

  if (tournament.status === "running" && tournament.started_at) {
    const current = blindLevelAt(
      tournament.blind_levels,
      tournament.started_at,
      tournament.blind_interval_minutes,
      now,
    );
    if (current.level !== tournament.current_level) {
      const { error } = await db
        .from("tournaments")
        .update({ current_level: current.level, updated_at: new Date(now).toISOString() })
        .eq("id", tournament.id);
      if (error) throw new Error(error.message);
      const { error: tableError } = await db
        .from("poker_tables")
        .update({
          small_blind: current.blinds.smallBlind,
          big_blind: current.blinds.bigBlind,
          updated_at: new Date(now).toISOString(),
        })
        .eq("id", table.id);
      if (tableError) throw new Error(tableError.message);
      tournament.current_level = current.level;
    }

    if (tournament.current_level > tournament.rebuy_until_level) {
      const expiredRebuys = (await getTournamentEntries(db, tournament.id)).filter(
        (entry) => entry.status === "rebuy_pending",
      );
      const { error } = await db
        .from("tournament_entries")
        .update({ status: "eliminated" })
        .eq("tournament_id", tournament.id)
        .eq("status", "rebuy_pending");
      if (error) throw new Error(error.message);
      if (expiredRebuys.length > 0) {
        const { error: seatsError } = await db
          .from("table_players")
          .update({ seat: null })
          .eq("table_id", table.id)
          .in(
            "user_id",
            expiredRebuys.map((entry) => entry.user_id),
          );
        if (seatsError) throw new Error(seatsError.message);
      }
    }
    await completeIfReady(db, tournament.id);
    tournament = (await getTournamentByTable(db, table.id))!;
  }
  return tournament;
}

export async function tournamentViewFor(
  db: AdminClient,
  table: TableRow,
  userId: string,
): Promise<TournamentView | null> {
  const tournament = await syncTournamentState(db, table);
  if (!tournament) return null;
  const entries = await getTournamentEntries(db, tournament.id);
  const now = Date.now();
  const opens = tournament.registration_opens_at
    ? Date.parse(tournament.registration_opens_at)
    : Number.NEGATIVE_INFINITY;
  const closes = tournament.registration_closes_at
    ? Date.parse(tournament.registration_closes_at)
    : Number.POSITIVE_INFINITY;
  const levelIndex = Math.max(
    0,
    Math.min(tournament.blind_levels.length - 1, tournament.current_level - 1),
  );
  const nextLevelAt =
    tournament.status === "running" &&
    tournament.started_at &&
    tournament.current_level < tournament.blind_levels.length
      ? new Date(
          Date.parse(tournament.started_at) +
            tournament.current_level * tournament.blind_interval_minutes * 60_000,
        ).toISOString()
      : null;
  const entryViews = entries.map((entry) => ({
    userId: entry.user_id,
    displayName: entry.display_name,
    status: entry.status,
    seat: entry.seat,
    rebuys: entry.rebuys,
    finishPosition: entry.finish_position,
    prizeAmount: entry.prize_amount,
    paidAt: entry.paid_at,
  }));

  return {
    id: tournament.id,
    format: tournament.format,
    status: tournament.status,
    buyIn: tournament.buy_in,
    houseFeePercent: tournament.house_fee_percent,
    startingStack: tournament.starting_stack,
    minPlayers: tournament.min_players,
    maxPlayers: tournament.max_players,
    registrationOpensAt: tournament.registration_opens_at,
    registrationClosesAt: tournament.registration_closes_at,
    registrationIsOpen: tournament.status === "registering" && now >= opens && now < closes,
    allowRebuys: tournament.allow_rebuys,
    maxRebuys: tournament.max_rebuys,
    rebuyUntilLevel: tournament.rebuy_until_level,
    blindIntervalMinutes: tournament.blind_interval_minutes,
    blindLevels: tournament.blind_levels,
    prizeStructure: tournament.prize_structure,
    currentLevel: tournament.current_level,
    currentBlinds: tournament.blind_levels[levelIndex]!,
    nextLevelAt,
    entriesCount: tournament.entries_count,
    remainingPlayers: tournament.remaining_players,
    prizePool: tournament.prize_pool,
    houseFeeTotal: tournament.house_fee_total,
    startedAt: tournament.started_at,
    completedAt: tournament.completed_at,
    hasPendingRebuys: entries.some((entry) => entry.status === "rebuy_pending"),
    entries: entryViews,
    me: entryViews.find((entry) => entry.userId === userId) ?? null,
  };
}

export async function registerTournamentPlayer(db: AdminClient, table: TableRow, userId: string) {
  const tournament = await getTournamentByTable(db, table.id);
  if (!tournament) throw new Error("Esta mesa no es un torneo");
  const { data, error } = await db.rpc("register_tournament_entry", {
    _tournament_id: tournament.id,
    _user_id: userId,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function unregisterTournamentPlayer(db: AdminClient, table: TableRow, userId: string) {
  const tournament = await getTournamentByTable(db, table.id);
  if (!tournament) throw new Error("Esta mesa no es un torneo");
  const { data, error } = await db.rpc("unregister_tournament_entry", {
    _tournament_id: tournament.id,
    _user_id: userId,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function rebuyTournamentPlayer(db: AdminClient, table: TableRow, userId: string) {
  const tournament = await getTournamentByTable(db, table.id);
  if (!tournament) throw new Error("Esta mesa no es un torneo");
  const { data, error } = await db.rpc("rebuy_tournament_entry", {
    _tournament_id: tournament.id,
    _user_id: userId,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function declineTournamentPlayerRebuy(
  db: AdminClient,
  table: TableRow,
  userId: string,
) {
  const tournament = await getTournamentByTable(db, table.id);
  if (!tournament) throw new Error("Esta mesa no es un torneo");
  const { error } = await db.rpc("decline_tournament_rebuy", {
    _tournament_id: tournament.id,
    _user_id: userId,
  });
  if (error) throw new Error(error.message);
  await db
    .from("table_players")
    .update({ seat: null })
    .eq("table_id", table.id)
    .eq("user_id", userId);
  await completeIfReady(db, tournament.id);
  return { ok: true };
}

export async function startTournamentNow(db: AdminClient, table: TableRow, hostId: string) {
  const tournament = await getTournamentByTable(db, table.id);
  if (!tournament) throw new Error("Esta mesa no es un torneo");
  if (tournament.host_id !== hostId) throw new Error("Solo el anfitrión puede iniciar el torneo");
  if (tournament.format === "sit_go" && tournament.entries_count < tournament.max_players) {
    throw new Error("El Sit & Go inicia automáticamente cuando se llena");
  }
  await startTournament(db, tournament);
  return { ok: true };
}

export async function cancelTournamentByHost(db: AdminClient, table: TableRow, hostId: string) {
  const tournament = await getTournamentByTable(db, table.id);
  if (!tournament) throw new Error("Esta mesa no es un torneo");
  if (tournament.host_id !== hostId) throw new Error("Solo el anfitrión puede cancelar el torneo");
  if (tournament.status === "running") {
    throw new Error("No puedes cerrar un torneo que ya comenzó");
  }
  if (tournament.status === "registering") await cancelTournament(db, tournament);
  return { ok: true };
}

export async function processTournamentHand(db: AdminClient, table: TableRow, state: HandState) {
  if (table.table_mode !== "tournament" || !state.complete) return;
  const tournament = await getTournamentByTable(db, table.id);
  if (!tournament || tournament.status !== "running") return;
  const entries = await getTournamentEntries(db, tournament.id);
  const activeByUser = new Map(
    entries.filter((entry) => entry.status === "active").map((entry) => [entry.user_id, entry]),
  );
  const busted = state.players
    .filter((player) => player.chips === 0 && activeByUser.has(player.userId))
    .sort((a, b) => a.committed - b.committed || b.seat - a.seat);
  let remaining = tournament.remaining_players;

  for (const player of busted) {
    const entry = activeByUser.get(player.userId)!;
    const canRebuy =
      tournament.allow_rebuys &&
      tournament.current_level <= tournament.rebuy_until_level &&
      entry.rebuys < tournament.max_rebuys;
    const { data: changed, error } = await db
      .from("tournament_entries")
      .update({
        status: canRebuy ? "rebuy_pending" : "eliminated",
        finish_position: remaining,
        eliminated_at: new Date().toISOString(),
      })
      .eq("id", entry.id)
      .eq("status", "active")
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!changed) continue;
    remaining = Math.max(0, remaining - 1);
    if (!canRebuy) {
      await db
        .from("table_players")
        .update({ seat: null })
        .eq("table_id", table.id)
        .eq("user_id", player.userId);
    }
  }

  if (remaining !== tournament.remaining_players) {
    const { error } = await db
      .from("tournaments")
      .update({ remaining_players: remaining, updated_at: new Date().toISOString() })
      .eq("id", tournament.id);
    if (error) throw new Error(error.message);
  }
  await completeIfReady(db, tournament.id);
}

export async function tournamentCanDeal(db: AdminClient, table: TableRow) {
  if (table.table_mode !== "tournament") return true;
  const tournament = await syncTournamentState(db, table);
  if (!tournament || tournament.status !== "running") return false;
  const { count, error } = await db
    .from("tournament_entries")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournament.id)
    .eq("status", "rebuy_pending");
  if (error) throw new Error(error.message);
  return (count ?? 0) === 0;
}

export async function tournamentEligibleUsers(db: AdminClient, tableId: string) {
  const tournament = await getTournamentByTable(db, tableId);
  if (!tournament) return null;
  const entries = await getTournamentEntries(db, tournament.id);
  return new Set(
    entries.filter((entry) => entry.status === "active").map((entry) => entry.user_id),
  );
}
