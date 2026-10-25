// Client for POST /auth/login and POST /auth/signup.
// Field names and error bodies match the board API:
// { "error": { "code", "message" } } and a session of { secret, token, mcp, user }.

export type AuthUser = {
  _id: string
  auth_username: string
  name: string
  role?: string
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

let cachedRaw: string | null = null
let cachedSession: AuthSession | null = null
let cachedUser: AuthUser | null = null

const USERNAME = /^[a-z][a-z0-9._-]{1,31}$/

export type SignUpInput = {
  username: string
  password: string
  name: string
  email?: string
  team?: string
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
  const team = input.team?.trim()
  return postAuth("/auth/signup", {
    username: input.username.trim(),
    password: input.password,
    name: input.name.trim(),
    ...(email ? { email } : {}),
    ...(team ? { team } : {}),
  })
}

export function readSession(): AuthSession | null {
  if (typeof window === "undefined") return null
  const raw = sessionStorage.getItem(SESSION_KEY)
  if (raw !== cachedRaw) remember(raw)
  return cachedSession
}

export function readSessionUser(): AuthUser | null {
  if (typeof window === "undefined") return null
  const raw = sessionStorage.getItem(SESSION_KEY)
  if (raw !== cachedRaw) remember(raw)
  return cachedUser
}

export function subscribeAuth(onChange: () => void): () => void {
  window.addEventListener(AUTH_EVENT, onChange)
  return () => window.removeEventListener(AUTH_EVENT, onChange)
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY)
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
  sessionStorage.setItem(SESSION_KEY, raw)
  remember(raw)
  publishAuth()
  return parsed
}

function remember(raw: string | null): void {
  cachedRaw = raw
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
