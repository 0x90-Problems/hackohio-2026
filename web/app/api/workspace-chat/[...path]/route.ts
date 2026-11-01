import { NextResponse } from "next/server"

import { chatOrigin, proxyBoard } from "@/lib/board-proxy"

export const dynamic = "force-dynamic"
export const revalidate = 0

// Workspace chat lives on the chat service under /chat/v1/*. Only those paths are
// proxied, with the caller's own bearer; the chat API authorizes every call.
// (/api/chat is Nutty, the board assistant.)
const ID = "[A-Za-z0-9_-]+"
const ALLOWED = new RegExp(
  `^(health|unread|live/session|workspace(/(pause|resume)-agents)?|sections(/${ID})?|me/sections|dms|channels(/${ID}(/(archive|join|members|read|pause|resume|instruction|search|folder|messages(/${ID}(/hide)?)?|threads/${ID}))?)?)$`
)

async function forward(request: Request, ctx: RouteContext<"/api/workspace-chat/[...path]">) {
  const { path } = await ctx.params
  const joined = path.join("/")
  if (!ALLOWED.test(joined)) {
    return NextResponse.json({ error: { code: "not_found", message: "Unknown chat route" } }, { status: 404 })
  }
  const search = new URL(request.url).search
  return proxyBoard(request, `/chat/v1/${joined}${search}`, chatOrigin())
}

export const GET = forward
export const POST = forward
export const PATCH = forward
export const PUT = forward
export const DELETE = forward
