import { NextResponse } from "next/server"

import { proxyBoard } from "@/lib/board-proxy"
import { multiOrgOn } from "@/lib/org-choice"
import { orgRoute } from "@/lib/org-routes"

export const dynamic = "force-dynamic"
export const revalidate = 0

// Organizations, members and invites (NSB-62), behind NEXT_PUBLIC_MULTI_ORG. Only the contract's
// routes go through (lib/org-routes.ts), with the caller's own bearer; the board authorizes each.
async function forward(request: Request, ctx: RouteContext<"/api/org/[...path]">) {
  const { path } = await ctx.params
  const target = multiOrgOn() ? orgRoute(request.method, path.join("/"), new URL(request.url).search) : null
  if (!target) {
    return NextResponse.json({ error: { code: "not_found", message: "Unknown org route" } }, { status: 404 })
  }
  return proxyBoard(request, target)
}

export const GET = forward
export const POST = forward
export const PATCH = forward
export const DELETE = forward
