import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertHostClaims } from "./host";
import type { CreateTournamentInput } from "./tournament";

const codeInput = (input: { code: string }) => ({
  code: String(input.code ?? "")
    .trim()
    .toUpperCase(),
});

export const createTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreateTournamentInput) => input)
  .handler(async ({ data, context }) => {
    assertHostClaims(context.claims);
    const { admin } = await import("./table.server");
    const { createTournamentTable } = await import("./tournament.server");
    return createTournamentTable(await admin(), context.userId, data);
  });

export const registerTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(codeInput)
  .handler(async ({ data, context }) => {
    const { admin, getTableByCode } = await import("./table.server");
    const { registerTournamentPlayer } = await import("./tournament.server");
    const db = await admin();
    return registerTournamentPlayer(db, await getTableByCode(db, data.code), context.userId);
  });

export const unregisterTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(codeInput)
  .handler(async ({ data, context }) => {
    const { admin, getTableByCode } = await import("./table.server");
    const { unregisterTournamentPlayer } = await import("./tournament.server");
    const db = await admin();
    return unregisterTournamentPlayer(db, await getTableByCode(db, data.code), context.userId);
  });

export const rebuyTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(codeInput)
  .handler(async ({ data, context }) => {
    const { admin, getTableByCode } = await import("./table.server");
    const { rebuyTournamentPlayer } = await import("./tournament.server");
    const db = await admin();
    return rebuyTournamentPlayer(db, await getTableByCode(db, data.code), context.userId);
  });

export const declineTournamentRebuy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(codeInput)
  .handler(async ({ data, context }) => {
    const { admin, getTableByCode } = await import("./table.server");
    const { declineTournamentPlayerRebuy } = await import("./tournament.server");
    const db = await admin();
    return declineTournamentPlayerRebuy(db, await getTableByCode(db, data.code), context.userId);
  });

export const startTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(codeInput)
  .handler(async ({ data, context }) => {
    assertHostClaims(context.claims);
    const { admin, getTableByCode } = await import("./table.server");
    const { startTournamentNow } = await import("./tournament.server");
    const db = await admin();
    return startTournamentNow(db, await getTableByCode(db, data.code), context.userId);
  });
