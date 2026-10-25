import { SCOPES, TOKEN_PREFIX, type Scope } from "@/shared/names"

// Plain-English names for each scope, in the order shown.
export const SCOPE_OPTIONS: { scope: Scope; label: string }[] = [
  { scope: SCOPES.TICKETS_READ, label: "Read tickets" },
  { scope: SCOPES.TICKETS_WRITE, label: "Create and move tickets" },
  { scope: SCOPES.COMMENTS_WRITE, label: "Comment" },
  { scope: SCOPES.TICKETS_CLOSE, label: "Close tickets (needs approval)" },
]

// Mock token/key. The real one will come from the backend, which stores only its hash.
export function makeToken(username: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  const random = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  const initials = username.replace(/[^a-z0-9]/gi, "").slice(0, 2).toLowerCase() || "xx"
  return `${TOKEN_PREFIX}${initials}_${random}`
}

// What's safe to show after creation: the prefix, then dots.
export const maskToken = (prefix: string) => `${prefix}••••••••`
