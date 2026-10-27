// Forwards the Next.js auth routes to the board API.
// BOARD_API_URL is the API origin. The password is passed through and not stored here.
// When the API is not configured, the body matches handleRequest with no directory:
// 503 { error: { code: "auth_unavailable", message: "Directory sign-in is not configured" } }.

const UNAVAILABLE = {
  error: { code: "auth_unavailable", message: "Directory sign-in is not configured" },
}

export async function proxyAuth(
  request: Request,
  path: "/auth/login" | "/auth/signup"
): Promise<Response> {
  const base = apiOrigin()
  if (!base) return Response.json(UNAVAILABLE, { status: 503 })

  const headers = new Headers()
  headers.set("accept", "application/json")
  headers.set("content-type", request.headers.get("content-type") ?? "application/json")
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) headers.set("x-forwarded-for", forwarded)

  let upstream: Response
  try {
    upstream = await fetch(new URL(path, base), {
      method: "POST",
      headers,
      body: await request.text(),
      redirect: "manual",
    })
  } catch {
    return Response.json(
      { error: { code: "ldap_unavailable", message: "The directory could not check those credentials" } },
      { status: 503 }
    )
  }

  const responseHeaders = new Headers()
  const contentType = upstream.headers.get("content-type")
  if (contentType) responseHeaders.set("content-type", contentType)
  const retryAfter = upstream.headers.get("retry-after")
  if (retryAfter) responseHeaders.set("retry-after", retryAfter)
  const text = await upstream.text()
  if (upstream.ok) await rememberDirectoryUser(text)
  return new Response(text, { status: upstream.status, headers: responseHeaders })
}

async function rememberDirectoryUser(text: string) {
  try {
    const body = JSON.parse(text) as {
      user?: { _id?: string; auth_username?: string; name?: string; role?: string; team?: string }
    }
    const user = body.user
    if (!user?._id || !user.auth_username || !user.name || !user.team) return
    const { getDb } = await import("@/lib/mongodb")
    const db = await getDb()
    await db.collection<{ _id: string }>("users").replaceOne(
      { _id: user._id },
      {
        _id: user._id,
        auth_username: user.auth_username,
        name: user.name,
        ...(user.role ? { role: user.role } : {}),
        team: user.team,
        type: "human",
      },
      { upsert: true }
    )
  } catch {
    // Sign-in still succeeds when the directory user cannot be copied into Mongo.
  }
}

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
      // try next
    }
  }
  return null
}
