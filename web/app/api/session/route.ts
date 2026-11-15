import { proxyBoard } from "@/lib/board-proxy"

export const dynamic = "force-dynamic"
export const revalidate = 0

// Is this sign-in still good? The board answers 401 (token_expired, token_revoked) when it isn't;
// that answer goes back as is. Anything else only says the session wasn't refused.
export async function GET(request: Request) {
  const upstream = await proxyBoard(request, "/me/membership")
  return upstream.status === 401 ? upstream : Response.json({ ok: true })
}
