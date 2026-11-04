// Signed-in file links (NSB-57). A file's address in the app is /api/files/<id>/view: it only
// opens for someone signed in who can read the file, and it hands the browser a fresh storage
// link that lasts a minute. Copying the address and opening it signed out shows the sign-in page.
//
// The session lives in this tab's sessionStorage, which a new tab or a download can't send, so
// signing in also puts the bearer in an HttpOnly cookie scoped to /api/files (FILE_COOKIE). The
// cookie grants nothing the bearer doesn't: the files API checks the team and the file's
// permissions on every request, exactly as it does for the folders proxy.
//
// Server-safe and dependency-free (relative imports only) so node --test can load it.

export const FILE_COOKIE = "nutshell_files"
export const FILE_COOKIE_PATH = "/api/files"
export const FILE_COOKIE_MAX_AGE = 12 * 60 * 60 // seconds; a bad or expired bearer clears it sooner

const FILE_ID = /^[A-Za-z0-9_-]{1,100}$/
const BEARER = /^[A-Za-z0-9._~+/=-]{8,4096}$/

export type ViewOptions = { version?: number; download?: boolean; team?: string }

/** The app's own address for a file: safe to copy, since it only opens for someone signed in. */
export function fileViewPath(fileId: string, options: ViewOptions = {}): string {
  const query = new URLSearchParams()
  if (options.version) query.set("v", String(options.version))
  if (options.download) query.set("download", "1")
  if (options.team) query.set("team", options.team)
  const search = query.toString()
  return `/api/files/${encodeURIComponent(fileId)}/view${search ? `?${search}` : ""}`
}

export function isFileId(value: string): boolean {
  return FILE_ID.test(value)
}

export function isBearer(value: string): boolean {
  return BEARER.test(value)
}

/** The cookie that lets /api/files/<id>/view act as this person. */
export function fileCookie(secret: string, secure: boolean): string {
  return [
    `${FILE_COOKIE}=${encodeURIComponent(secret)}`,
    `Path=${FILE_COOKIE_PATH}`,
    `Max-Age=${FILE_COOKIE_MAX_AGE}`,
    "HttpOnly",
    "SameSite=Lax", // sent when a teammate clicks the link, never on another site's images or posts
    ...(secure ? ["Secure"] : []),
  ].join("; ")
}

export function clearedFileCookie(secure: boolean): string {
  return [`${FILE_COOKIE}=`, `Path=${FILE_COOKIE_PATH}`, "Max-Age=0", "HttpOnly", "SameSite=Lax", ...(secure ? ["Secure"] : [])].join("; ")
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null
  for (const part of header.split(";")) {
    const at = part.indexOf("=")
    if (at < 0 || part.slice(0, at).trim() !== name) continue
    try {
      const value = decodeURIComponent(part.slice(at + 1).trim())
      return value || null
    } catch {
      return null
    }
  }
  return null
}

/** Only links to the files bucket are followed: the route never redirects anywhere else. */
export function isStorageUrl(raw: unknown, bucketHosts: string[]): raw is string {
  if (typeof raw !== "string") return false
  try {
    const url = new URL(raw)
    return url.protocol === "https:" && bucketHosts.includes(url.hostname)
  } catch {
    return false
  }
}

// Never cached by the browser or Vercel, and the storage link never leaks onward as a referrer.
const PRIVATE = { "cache-control": "no-store, private", "referrer-policy": "no-referrer", "x-content-type-options": "nosniff" }

export type FetchLink = (path: string, bearer: string, team: string | null) => Promise<Response>

export type ViewDeps = {
  fetchLink: FetchLink
  bucketHosts: string[]
  secure: boolean
}

function wantsPage(request: Request) {
  return (request.headers.get("accept") ?? "").includes("text/html")
}

function signedOut(request: Request, deps: ViewDeps, clear: boolean): Response {
  const headers = new Headers(PRIVATE)
  if (clear) headers.append("set-cookie", clearedFileCookie(deps.secure))
  // A person in a browser goes to sign in; anything else just hears 401. Never the file.
  if (wantsPage(request)) {
    headers.set("location", new URL("/login", request.url).toString())
    return new Response(null, { status: 302, headers })
  }
  headers.set("content-type", "application/json")
  return new Response(JSON.stringify({ ok: false, error: "unauthorized", message: "Sign in to open this file" }), { status: 401, headers })
}

function refused(request: Request, status: number, error: string, message: string): Response {
  // A person who opened the link in a tab reads a sentence; the app reads JSON.
  if (wantsPage(request)) return new Response(message, { status, headers: { ...PRIVATE, "content-type": "text/plain; charset=utf-8" } })
  return new Response(JSON.stringify({ ok: false, error, message }), {
    status,
    headers: { ...PRIVATE, "content-type": "application/json" },
  })
}

/** GET /api/files/<id>/view[?v=<n>][&download=1][&team=<name>] */
export async function handleFileView(request: Request, fileId: string, deps: ViewDeps): Promise<Response> {
  if (!isFileId(fileId)) return refused(request, 404, "not_found", "No such file")
  const url = new URL(request.url)
  const version = url.searchParams.get("v")
  if (version !== null && !/^[1-9]\d{0,8}$/.test(version)) return refused(request, 400, "bad_version", "Version must be a positive number")
  const team = url.searchParams.get("team")
  if (team !== null && (team.length === 0 || team.length > 300)) return refused(request, 400, "bad_team", "Unknown team")

  const bearer = readCookie(request.headers.get("cookie"), FILE_COOKIE)
  if (!bearer || !isBearer(bearer)) return signedOut(request, deps, Boolean(bearer))

  const inline = url.searchParams.get("download") !== "1"
  const path = `/fs/files/${fileId}${version ? `/versions/${version}` : ""}/link${inline ? "?inline=1" : ""}`
  let upstream: Response
  try {
    upstream = await deps.fetchLink(path, bearer, team)
    // Same as the app: a team you've since left falls back to your default team.
    if (upstream.status === 403 && team) {
      const body = (await upstream.clone().json().catch(() => null)) as { error?: string } | null
      if (body?.error === "not_on_team") upstream = await deps.fetchLink(path, bearer, null)
    }
  } catch {
    return refused(request, 503, "files_unavailable", "Files couldn't be reached. Try again.")
  }

  if (upstream.status === 401) return signedOut(request, deps, true)
  if (!upstream.ok) {
    // Off limits and missing look the same, so the address says nothing about files you can't see.
    if (upstream.status === 403 || upstream.status === 404) return refused(request, 404, "not_found", "This file doesn't exist or you don't have access to it")
    const body = (await upstream.json().catch(() => null)) as { error?: string; message?: string } | null
    return refused(request, upstream.status >= 500 ? 503 : upstream.status, body?.error ?? "error", body?.message ?? "Couldn't open this file")
  }
  const body = (await upstream.json().catch(() => null)) as { url?: unknown } | null
  if (!isStorageUrl(body?.url, deps.bucketHosts)) return refused(request, 502, "bad_link", "Files returned an unexpected link")
  return new Response(null, { status: 302, headers: { ...PRIVATE, location: body.url } })
}

/** POST /api/files/session (Authorization: Bearer) sets the cookie; DELETE clears it. */
export function handleFileSession(request: Request, secure: boolean): Response {
  const headers = new Headers(PRIVATE)
  if (request.method === "DELETE") {
    headers.append("set-cookie", clearedFileCookie(secure))
    return new Response(null, { status: 204, headers })
  }
  // A custom header can't be sent cross-site without CORS, so another site can't plant its own
  // account's cookie in this browser.
  const auth = request.headers.get("authorization") ?? ""
  const secret = auth.startsWith("Bearer ") ? auth.slice(7).trim() : ""
  if (!isBearer(secret)) {
    headers.set("content-type", "application/json")
    return new Response(JSON.stringify({ ok: false, error: "unauthorized", message: "Sign in first" }), { status: 401, headers })
  }
  headers.append("set-cookie", fileCookie(secret, secure))
  return new Response(null, { status: 204, headers })
}
