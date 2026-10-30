import { NextResponse } from "next/server"

import { docsOrigin, proxyBoard } from "@/lib/board-proxy"

export const dynamic = "force-dynamic"
export const revalidate = 0

// Live documents live on the documents relay under /docs/v1/*. Only those paths are
// proxied, with the caller's own bearer; the relay authorizes every call.
const ALLOWED = /^(health|pages\/nte_[A-Za-z0-9]+\/(session|updates))$/

async function forward(request: Request, ctx: RouteContext<"/api/docs-live/[...path]">) {
  const { path } = await ctx.params
  const joined = path.join("/")
  if (!ALLOWED.test(joined)) {
    return NextResponse.json({ error: { code: "not_found", message: "Unknown documents route" } }, { status: 404 })
  }
  const search = new URL(request.url).search
  return proxyBoard(request, `/docs/v1/${joined}${search}`, docsOrigin())
}

export const GET = forward
export const POST = forward
