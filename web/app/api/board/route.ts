import { NextResponse } from "next/server"

import { proxyBoard } from "@/lib/board-proxy"

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * Board data path after Atlas shutdown: proxy to the AWS board API (DocumentDB).
 * Clients must send Authorization: Bearer <session secret> (same token as login).
 * Direct MONGODB_URI access is retired — DocDB is VPC-only.
 */
export async function GET(request: Request) {
  return proxyBoard(request, "/board")
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization")
  if (!authorization) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Sign in to change the board" } },
      { status: 401 },
    )
  }

  let body: {
    kind?: string
    key?: string
    projectKey?: string
    project?: { name: string; key: string; template?: string }
    ticket?: {
      key?: string
      title: string
      label?: string
      status?: string
      reviewer_id?: string
      due_date?: string
      project_key?: string
    }
    comment?: { ticket_key: string; body: string }
    event?: unknown
    agent?: { name: string; scopes?: string[]; connection?: string }
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: { code: "invalid_input", message: "Body must be JSON" } }, { status: 400 })
  }

  const headers = {
    accept: "application/json",
    authorization,
    "content-type": "application/json",
  }

  // Rebuild Request so proxyBoard can read the body we already consumed.
  const forward = (path: string, method: string, payload?: unknown) =>
    proxyBoard(
      new Request(request.url, {
        method,
        headers,
        body: payload === undefined ? undefined : JSON.stringify(payload),
      }),
      path,
    )

  if (body.kind === "allocateKey" && body.projectKey) {
    return forward("/ticket-keys", "POST", { project: body.projectKey })
  }
  if (body.kind === "deleteProject" && body.key) {
    return forward(`/projects/${encodeURIComponent(body.key)}`, "DELETE")
  }
  if (body.kind === "deleteTicket" && body.key) {
    return forward(`/tickets/${encodeURIComponent(body.key)}`, "DELETE")
  }
  if (body.kind === "project" && body.project) {
    return forward("/projects", "POST", {
      name: body.project.name,
      key: body.project.key,
      template: body.project.template ?? "blank",
    })
  }
  if (body.kind === "createTicket" && body.ticket) {
    // The board API assigns the key, so a create is never a PATCH of an unsaved key.
    const ticket = body.ticket
    return forward("/tickets", "POST", {
      title: ticket.title,
      ...(ticket.label ? { label: ticket.label } : {}),
      ...(ticket.reviewer_id ? { reviewer_id: ticket.reviewer_id } : {}),
      ...(ticket.due_date ? { due_date: ticket.due_date } : {}),
      ...(ticket.project_key ? { project: ticket.project_key } : {}),
    })
  }
  if (body.kind === "ticket" && body.ticket) {
    const ticket = body.ticket
    // Prefer PATCH when key exists; create when client omitted persistence of a new key.
    if (ticket.key) {
      return forward(`/tickets/${encodeURIComponent(ticket.key)}`, "PATCH", {
        ...(ticket.title !== undefined ? { title: ticket.title } : {}),
        ...(ticket.label !== undefined ? { label: ticket.label } : {}),
        ...(ticket.status !== undefined ? { status: ticket.status } : {}),
        ...(ticket.reviewer_id !== undefined ? { reviewer_id: ticket.reviewer_id } : {}),
        ...(ticket.due_date !== undefined ? { due_date: ticket.due_date } : {}),
      })
    }
    return forward("/tickets", "POST", {
      title: ticket.title,
      ...(ticket.label ? { label: ticket.label } : {}),
      ...(ticket.reviewer_id ? { reviewer_id: ticket.reviewer_id } : {}),
      ...(ticket.due_date ? { due_date: ticket.due_date } : {}),
      ...(ticket.project_key ? { project: ticket.project_key } : {}),
    })
  }
  if (body.kind === "comment" && body.comment) {
    return forward(`/tickets/${encodeURIComponent(body.comment.ticket_key)}/comments`, "POST", {
      body: body.comment.body,
    })
  }
  if (body.kind === "event") {
    // Events are recorded by the board API on mutations; acknowledge no-op for UI local echoes.
    return NextResponse.json({ ok: true })
  }
  if (body.kind === "agent" && body.agent) {
    return forward("/agents", "POST", {
      name: body.agent.name,
      scopes: body.agent.scopes ?? ["tickets:read", "tickets:write"],
      ...(body.agent.connection ? { connection: body.agent.connection } : {}),
    })
  }

  return NextResponse.json({ error: { code: "invalid_input", message: "Missing board document" } }, { status: 400 })
}
