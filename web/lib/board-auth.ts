// Client for POST /auth/login and POST /auth/signup.
// Field names and error bodies match the board API:
// { "error": { "code", "message" } } and a session of { secret, token, mcp, user }.

import { safeReturnPath } from "@/lib/return-path"
import { expiryOf, type SignedOutReason } from "@/lib/session-expiry"

export type AuthUser = {
  _id: string
  auth_username: string
  name: string
  role?: string
  admin?: boolean
  team: string
  type: "human"
}

export type AuthSession = {
  secret: string
  user: AuthUser
}

export class AuthApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = "AuthApiError"
    this.code = code
    this.status = status
  }
}

const SESSION_KEY = "buck2.auth"
const AUTH_EVENT = "buck2-auth"
// Why the last session ended and where the person was, shown on the sign-in page. This tab only.
const NOTICE_KEY = "buck2.signed-out"

export type SignedOutNotice = { reason: SignedOutReason; from: string }

let cachedRaw: string | null = null
let cachedSession: AuthSession | null = null
let cachedUser: AuthUser | null = null
let cachedExpiry: number | null = null
let noticeRaw: string | null = null
let cachedNotice: SignedOutNotice | null = null

const USERNAME = /^[a-z][a-z0-9._-]{1,31}$/

export type SignUpInput = {
  username: string
  password: string
  name: string
  email?: string
}

export function validateUsername(username: string): string | null {
  const value = username.trim().toLowerCase()
  if (!USERNAME.test(value)) {
    return "Username must start with a letter and use letters, numbers, dots, or hyphens"
  }
  return null
}

export function validateSignIn(input: { username: string; password: string }): string | null {
  return validateUsername(input.username) ?? (input.password ? null : "Username or password is wrong")
}

export function validateSignUp(input: SignUpInput): string | null {
  const usernameError = validateUsername(input.username)
  if (usernameError) return usernameError
  if (!input.name.trim()) return "Name is required"
  if (input.password.length < 8) return "Password must be at least 8 characters"
  const email = input.email?.trim()
  if (email && !email.includes("@")) return "Email is required"
  return null
}

export function signIn(input: { username: string; password: string }): Promise<AuthSession> {
  return postAuth("/auth/login", {
    username: input.username.trim(),
    password: input.password,
  })
}

export function signUp(input: SignUpInput): Promise<AuthSession> {
  const email = input.email?.trim()
  return postAuth("/auth/signup", {
    username: input.username.trim(),
    password: input.password,
    name: input.name.trim(),
    ...(email ? { email } : {}),
  })
}

export function readSession(): AuthSession | null {
  if (typeof window === "undefined") return null
  const raw = storedSession()
  if (raw !== cachedRaw) remember(raw)
  return cachedSession
}

export function readSessionUser(): AuthUser | null {
  if (typeof window === "undefined") return null
  const raw = storedSession()
  if (raw !== cachedRaw) remember(raw)
  return cachedUser
}

/** When this sign-in runs out (ms since the epoch); null if signed out or the board didn't say. */
export function readSessionExpiry(): number | null {
  if (typeof window === "undefined") return null
  const raw = storedSession()
  if (raw !== cachedRaw) remember(raw)
  return cachedExpiry
}

/** Sign out because the session ended, remembering why and where so the sign-in page can say so. */
export function endSession(reason: SignedOutReason): void {
  if (typeof window === "undefined" || !storedSession()) return
  const from = `${window.location.pathname}${window.location.search}`
  sessionStorage.setItem(NOTICE_KEY, JSON.stringify({ reason, from }))
  clearSession()
}

export function readSignedOutNotice(): SignedOutNotice | null {
  if (typeof window === "undefined") return null
  const raw = sessionStorage.getItem(NOTICE_KEY)
  if (raw === noticeRaw) return cachedNotice
  noticeRaw = raw
  cachedNotice = null
  try {
    const parsed = raw ? (JSON.parse(raw) as { reason?: unknown; from?: unknown }) : null
    const reason = parsed?.reason
    if (reason === "expired" || reason === "revoked" || reason === "renew") {
      // Only a page inside the app, and never back to the sign-in pages themselves.
      const from = safeReturnPath(typeof parsed?.from === "string" ? parsed.from : null, "/")
      cachedNotice = { reason, from: /^\/(login|signup)(\/|\?|$)/.test(from) ? "/" : from }
    }
  } catch {
    // unreadable: no notice
  }
  return cachedNotice
}

export function dropSignedOutNotice(): void {
  sessionStorage.removeItem(NOTICE_KEY)
  publishAuth()
}

export function subscribeAuth(onChange: () => void): () => void {
  watchOtherTabs()
  window.addEventListener(AUTH_EVENT, onChange)
  return () => window.removeEventListener(AUTH_EVENT, onChange)
}

/**
 * The sign-in is shared by every tab of this browser (localStorage), so a new tab is already
 * signed in. One kept by an older version in this tab only (sessionStorage) is moved over.
 */
function storedSession(): string | null {
  const shared = localStorage.getItem(SESSION_KEY)
  if (shared) return shared
  const own = sessionStorage.getItem(SESSION_KEY)
  if (!own) return null
  localStorage.setItem(SESSION_KEY, own)
  sessionStorage.removeItem(SESSION_KEY)
  return own
}

let watchingTabs = false

// Signing in or out in another tab reaches this one as a storage event.
function watchOtherTabs(): void {
  if (watchingTabs || typeof window === "undefined") return
  watchingTabs = true
  window.addEventListener("storage", (event) => {
    if (event.key !== SESSION_KEY || event.storageArea !== localStorage) return
    // Signed out over there: this tab says why on its own sign-in page, and comes back to its own page.
    if (event.oldValue && !event.newValue && !sessionStorage.getItem(NOTICE_KEY)) {
      let ended: number | null = null
      try {
        ended = expiryOf(JSON.parse(event.oldValue))
      } catch {
        // unreadable: treated as signed out
      }
      const reason: SignedOutReason = ended !== null && Date.now() >= ended ? "expired" : "revoked"
      sessionStorage.setItem(NOTICE_KEY, JSON.stringify({ reason, from: `${window.location.pathname}${window.location.search}` }))
    }
    publishAuth()
  })
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
  sessionStorage.removeItem(SESSION_KEY)
  // File links check an HttpOnly cookie (lib/file-links.ts); signing out drops it too.
  void fetch("/api/files/session", { method: "DELETE", keepalive: true }).catch(() => undefined)
  remember(null)
  publishAuth()
}

async function postAuth(path: "/auth/login" | "/auth/signup", body: unknown): Promise<AuthSession> {
  let response: Response
  try {
    response = await fetch(path, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new AuthApiError("auth_unavailable", "Directory sign-in is not configured", 503)
  }
  if (!response.ok) throw await errorFrom(response)
  let parsed: unknown
  try {
    parsed = await response.json()
  } catch {
    throw new AuthApiError("request_failed", "Sign-in returned an unexpected response", response.status)
  }
  if (!isAuthSession(parsed)) {
    throw new AuthApiError("request_failed", "Sign-in returned an unexpected response", response.status)
  }
  const raw = JSON.stringify(parsed)
  localStorage.setItem(SESSION_KEY, raw)
  remember(raw)
  publishAuth()
  return parsed
}

function remember(raw: string | null): void {
  cachedRaw = raw
  cachedExpiry = null
  if (!raw) {
    cachedSession = null
    cachedUser = null
    return
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (isAuthSession(parsed)) {
      cachedSession = parsed
      cachedUser = parsed.user
      cachedExpiry = expiryOf(parsed)
      return
    }
  } catch {
    // Fall through and drop the unreadable session.
  }
  cachedSession = null
  cachedUser = null
}

function publishAuth(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(AUTH_EVENT))
}

async function errorFrom(response: Response): Promise<AuthApiError> {
  try {
    const body = (await response.json()) as { error?: { code?: string; message?: string } }
    return new AuthApiError(
      body.error?.code ?? "request_failed",
      body.error?.message ?? response.statusText,
      response.status
    )
  } catch {
    return new AuthApiError("request_failed", response.statusText || "Sign-in failed", response.status)
  }
}

function isAuthSession(value: unknown): value is AuthSession {
  if (value === null || typeof value !== "object") return false
  const secret = (value as { secret?: unknown }).secret
  const user = (value as { user?: unknown }).user
  return typeof secret === "string" && secret.length > 0 && isAuthUser(user)
}

function isAuthUser(value: unknown): value is AuthUser {
  if (value === null || typeof value !== "object") return false
  const user = value as Partial<AuthUser>
  return (
    typeof user._id === "string" &&
    typeof user.auth_username === "string" &&
    typeof user.name === "string" &&
    typeof user.team === "string" &&
    user.type === "human"
  )
}
