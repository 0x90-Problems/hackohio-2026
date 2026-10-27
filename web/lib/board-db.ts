"use client"

import { toast } from "sonner"

import { readSession } from "@/lib/board-auth"
import type { Agent, Comment, Event, Project, Ticket } from "@/lib/types"
import { reviveValue } from "@/lib/local-store"

export type BoardRecords = {
  projects: Project[]
  tickets: Ticket[]
  comments: Comment[]
  events: Event[]
  agents: Agent[]
}

const EMPTY: BoardRecords = { projects: [], tickets: [], comments: [], events: [], agents: [] }

function authHeaders(extra?: HeadersInit): HeadersInit {
  const session = readSession()
  return {
    ...(extra ?? {}),
    ...(session?.secret ? { authorization: `Bearer ${session.secret}` } : {}),
  }
}

export async function loadBoard(): Promise<BoardRecords> {
  const response = await fetch("/api/board", { cache: "no-store", headers: authHeaders() })
  const body = (await response.json()) as BoardRecords & { error?: { message?: string } }
  if (!response.ok) throw new Error(body.error?.message ?? "Could not load the board")
  return reviveValue({
    projects: body.projects ?? [],
    tickets: body.tickets ?? [],
    comments: body.comments ?? [],
    events: body.events ?? [],
    agents: body.agents ?? [],
  })
}

async function save(kind: string, document: object) {
  const response = await fetch("/api/board", {
    method: "POST",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ kind, [kind]: document }),
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message ?? "Could not save to the database")
  }
}

function report(error: unknown) {
  toast.error("Couldn't save to the database", {
    description: error instanceof Error ? error.message : undefined,
  })
}

export function saveProject(project: Project) {
  void save("project", project).catch(report)
}

export function removeProject(key: string) {
  return fetch("/api/board", {
    method: "POST",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ kind: "deleteProject", key }),
  })
    .then(async (response) => {
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
        throw new Error(body?.error?.message ?? "Could not delete the project")
      }
    })
    .catch(report)
}

export async function removeTicketRecord(key: string) {
  const response = await fetch("/api/board", {
    method: "POST",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ kind: "deleteTicket", key }),
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message ?? "Could not delete the ticket")
  }
}

function ticketPayload(ticket: Ticket) {
  const record = { ...ticket } as Ticket & Record<string, unknown>
  delete record.needs_approval
  delete record.approved_by
  delete record.approved_at
  return record
}

export function saveTicket(ticket: Ticket) {
  void save("ticket", ticketPayload(ticket)).catch(report)
}

// Description edits report their own single error after typing settles.
export function saveTicketQuiet(ticket: Ticket): Promise<void> {
  return save("ticket", ticketPayload(ticket))
}

export function saveComment(comment: Comment) {
  void save("comment", comment).catch(report)
}

export function saveEvent(event: Event) {
  void save("event", event).catch(report)
}

export function saveAgent(agent: Agent) {
  void save("agent", agent).catch(report)
}

export { EMPTY }
