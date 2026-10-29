import { NextResponse } from "next/server"

import { proxyBoard, whiteboardOrigin } from "@/lib/board-proxy"

export const dynamic = "force-dynamic"
export const revalidate = 0

// Whiteboards live on the whiteboard service under /wb/v1/*. Only those paths are
// proxied, with the caller's own bearer; the whiteboard API authorizes every call.
const ALLOWED = /^(health|boards\/wbd_[A-Za-z0-9]+(\/(session|elements))?)$/

async function forward(request: Request, ctx: RouteContext<"/api/wb/[...path]">) {
  const { path } = await ctx.params
  const joined = path.join("/")
  if (!ALLOWED.test(joined)) {
    return NextResponse.json({ error: { code: "not_found", message: "Unknown whiteboard route" } }, { status: 404 })
  }
  const origin = whiteboardOrigin()
  if (!origin) {
    // Not configured yet: report "off" rather than falling through to another service.
    if (joined === "health") return NextResponse.json({ ok: false, enabled: false })
    return NextResponse.json({ error: { code: "feature_disabled", message: "Whiteboards aren't set up yet" } }, { status: 503 })
  }
  const search = new URL(request.url).search
  return proxyBoard(request, `/wb/v1/${joined}${search}`, origin)
}

export const GET = forward
export const POST = forward
