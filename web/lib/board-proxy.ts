// Forwards an authenticated board request to BOARD_API_URL.
// When the API is not configured, the client can fall back to a local token.

const UNAVAILABLE = {
  error: { code: "board_unavailable", message: "The board API is not configured" },
}

export async function proxyBoard(request: Request, path: string, origin?: URL | null): Promise<Response> {
  const base = origin ?? apiOrigin()
  if (!base) return Response.json(UNAVAILABLE, { status: 503 })

  const headers = new Headers()
  headers.set("accept", "application/json")
  const authorization = request.headers.get("authorization")
  if (authorization) headers.set("authorization", authorization)
  const contentType = request.headers.get("content-type")
  if (contentType) headers.set("content-type", contentType)
  // Folder writes carry the folder's rev for optimistic concurrency.
  // Browsers send the rev as x-fs-rev (Vercel's edge answers If-Match itself with
  // 412); the server-to-server hop to the files API uses the real If-Match.
  const rev = request.headers.get("x-fs-rev")
  if (rev && /^\d+$/.test(rev)) headers.set("if-match", `"rev-${rev}"`)
  // Chat posts carry an Idempotency-Key so a retried send never posts twice.
  const idempotency = request.headers.get("idempotency-key")
  if (idempotency && idempotency.length <= 100) headers.set("idempotency-key", idempotency)
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) headers.set("x-forwarded-for", forwarded)
  const shadow = request.headers.get("x-nutshell-mcp-path")
  if (shadow) headers.set("x-nutshell-mcp-path", shadow)

  let upstream: Response
  try {
    upstream = await fetch(new URL(path, base), {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.text(),
      redirect: "manual",
    })
  } catch {
    return Response.json(UNAVAILABLE, { status: 503 })
  }

  const responseHeaders = new Headers()
  const responseType = upstream.headers.get("content-type")
  if (responseType) responseHeaders.set("content-type", responseType)
  const retryAfter = upstream.headers.get("retry-after")
  if (retryAfter) responseHeaders.set("retry-after", retryAfter)
  return new Response(await upstream.text(), { status: upstream.status, headers: responseHeaders })
}

/** AWS board HTTP API — preferred while the Vercel board host is still 503. */
const AWS_BOARD_FALLBACK = "https://um433hdwe5.execute-api.us-east-1.amazonaws.com"

function apiOrigin(): URL | null {
  const configured = process.env.BOARD_API_URL?.trim()
  const skipConfigured =
    !configured ||
    configured.includes("0x90-board-api.vercel.app")
  const candidates = skipConfigured
    ? [AWS_BOARD_FALLBACK, configured]
    : [configured, AWS_BOARD_FALLBACK]
  for (const raw of candidates) {
    if (!raw) continue
    try {
      const url = new URL(raw)
      if (url.protocol !== "http:" && url.protocol !== "https:") continue
      return url
    } catch {
      // try next candidate
    }
  }
  return null
}

/** Files service HTTP API (folders live under /fs/*). */
const FILES_API_FALLBACK = "https://nzl07wu6wi.execute-api.us-east-1.amazonaws.com"

export function filesOrigin(): URL {
  const configured = process.env.FILES_API_URL?.trim()
  try {
    if (configured) return new URL(configured)
  } catch {
    // fall through to the default
  }
  return new URL(FILES_API_FALLBACK)
}

/** Whiteboard service HTTP API (/wb/v1/*). */
const WHITEBOARD_API_FALLBACK = "https://td6059qsl2.execute-api.us-east-1.amazonaws.com"

export function whiteboardOrigin(): URL | null {
  const configured = process.env.WHITEBOARD_API_URL?.trim()
  try {
    return new URL(configured || WHITEBOARD_API_FALLBACK)
  } catch {
    return new URL(WHITEBOARD_API_FALLBACK)
  }
}

/** Chat service HTTP API (workspace chat lives under /chat/v1/*). */
const CHAT_API_FALLBACK = "https://8xirsuul6a.execute-api.us-east-1.amazonaws.com"

export function chatOrigin(): URL {
  const configured = process.env.CHAT_API_URL?.trim()
  try {
    if (configured) return new URL(configured)
  } catch {
    // fall through to the default
  }
  return new URL(CHAT_API_FALLBACK)
}
