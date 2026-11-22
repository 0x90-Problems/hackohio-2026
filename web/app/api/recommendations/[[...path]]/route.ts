import { NextResponse } from "next/server"

import { proxyBoard } from "@/lib/board-proxy"

export const dynamic = "force-dynamic"
export const revalidate = 0

// Suggestions from your agents (NSB-88), with your own bearer; the board decides what you see.
// Only these routes go through:
//   GET  /api/recommendations?status=open|dismissed|done|all
//   POST /api/recommendations/dismiss
//   POST /api/recommendations/<id>/done
async function forward(request: Request, ctx: RouteContext<"/api/recommendations/[[...path]]">) {
  const { path = [] } = await ctx.params
  const notFound = NextResponse.json({ error: { code: "not_found", message: "Unknown suggestions route" } }, { status: 404 })
  if (request.method === "GET" && path.length === 0) {
    const status = new URL(request.url).searchParams.get("status") ?? "open"
    if (!["open", "dismissed", "done", "all"].includes(status)) return notFound
    return proxyBoard(request, `/recommendations?status=${status}`)
  }
  if (request.method === "POST" && path.length === 1 && path[0] === "dismiss") return proxyBoard(request, "/recommendations/dismiss")
  if (request.method === "POST" && path.length === 2 && /^rec_[0-9a-f]{8,40}$/.test(path[0]) && path[1] === "done") {
    return proxyBoard(request, `/recommendations/${path[0]}/done`)
  }
  return notFound
}

export const GET = forward
export const POST = forward
