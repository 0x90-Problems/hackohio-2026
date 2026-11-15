// When a sign-in ends and what to tell the person. A session ends when its token runs out (the
// organization's token expiry) or is revoked; without this the app just started failing.

/** How long before the end to warn. */
export const WARN_MS = 10 * 60_000

export type SignedOutReason = "expired" | "revoked" | "renew"

export type SessionPhase = "unknown" | "ok" | "soon" | "expired"

/** When a sign-in response's token runs out, in ms since the epoch; null when it doesn't say. */
export function expiryOf(session: unknown): number | null {
  const token = (session as { token?: unknown } | null)?.token
  const raw = (token as { expires_at?: unknown } | null)?.expires_at
  if (typeof raw !== "string") return null
  const at = Date.parse(raw)
  return Number.isFinite(at) ? at : null
}

export function sessionPhase(expiresAt: number | null, now: number): SessionPhase {
  if (expiresAt === null) return "unknown"
  if (now >= expiresAt) return "expired"
  return expiresAt - now <= WARN_MS ? "soon" : "ok"
}

/** Why the board refused this sign-in, from its 401; null when the answer isn't about the session. */
export function refusedReason(status: number, code: unknown): "expired" | "revoked" | null {
  if (status !== 401) return null
  if (code === "token_expired") return "expired"
  return code === "token_revoked" || code === "unauthorized" ? "revoked" : null
}

/** The line on the sign-in page after being signed out. */
export function signedOutMessage(reason: SignedOutReason): string {
  if (reason === "expired") return "Your session expired, so you were signed out. Sign in again to pick up where you left off."
  if (reason === "revoked") return "You were signed out. Sign in again to continue."
  return "Sign in again to start a new session."
}
