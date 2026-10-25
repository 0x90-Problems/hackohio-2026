"use client"

import { toast } from "sonner"

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

export async function loadBoard(): Promise<BoardRecords> {
  const response = await fetch("/api/board", { cache: "no-store" })
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
    headers: { "content-type": "application/json" },
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
    headers: { "content-type": "application/json" },
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

export function saveTicket(ticket: Ticket) {
  void save("ticket", ticket).catch(report)
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
