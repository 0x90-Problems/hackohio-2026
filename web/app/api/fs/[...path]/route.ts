import { NextResponse } from "next/server"

import { filesOrigin, proxyBoard } from "@/lib/board-proxy"

export const dynamic = "force-dynamic"
export const revalidate = 0

// Folders (F1) live on the files service under /fs/*. Only those paths are
// proxied, with the caller's own bearer; the files API authorizes every call.
const ALLOWED =
  /^(health|workspace|trash|uploads(\/[A-Za-z0-9_-]+)?|notes(\/[A-Za-z0-9_-]+)?|folders(\/[A-Za-z0-9_-]+(\/(children|path|restore|acl))?)?|files\/[A-Za-z0-9_-]+(\/(restore|restore-version|versions(\/\d+(\/link)?)?|link))?)$/

async function forward(request: Request, ctx: RouteContext<"/api/fs/[...path]">) {
  const { path } = await ctx.params
  const joined = path.join("/")
  if (!ALLOWED.test(joined)) {
    return NextResponse.json({ ok: false, error: "not_found", message: "Unknown folders route" }, { status: 404 })
  }
  const search = new URL(request.url).search
  return proxyBoard(request, `/fs/${joined}${search}`, filesOrigin())
}

export const GET = forward
export const POST = forward
export const PATCH = forward
export const PUT = forward
export const DELETE = forward
