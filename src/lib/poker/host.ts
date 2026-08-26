/**
 * Single owner of the club: only this account can create tables, deal hands and
 * hand out chips. Everyone else is a guest.
 */
export const HOST_EMAIL = "leon.f.castellon@gmail.com";

export function isHostEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === HOST_EMAIL;
}

/** Throws unless the authenticated claims belong to the club owner. */
export function assertHostClaims(claims: { email?: unknown }): void {
  const email = typeof claims.email === "string" ? claims.email : null;
  if (!isHostEmail(email)) throw new Error("Solo el anfitrión del club puede hacer esto");
}
