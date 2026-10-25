import { NextResponse } from "next/server"

import { agentDoc, commentDoc, eventDoc, projectDoc, ticketDoc } from "@/lib/board-docs"
import { mergeBoardRecords } from "@/lib/board-merge"
import { ensureBoardSchema, nextTicketKey } from "@/lib/ensure-board-schema"
import { getDb } from "@/lib/mongodb"
import type { Agent, Comment, Event, Project, Ticket } from "@/lib/types"
import { COLLECTIONS } from "@/shared/names"

const TICKET_FIELDS = new Set([
  "key", "project_key", "title", "tags", "label", "status", "created_by", "reviewer_id",
  "owner_id", "due_date", "description",
  "card_color", "fields", "linked_commits", "created_at",
])
const ACTOR_FIELDS = new Set(["type", "id", "name", "acting_for"])

export const dynamic = "force-dynamic"
export const revalidate = 0

async function deleteProjectDocs(db: Awaited<ReturnType<typeof getDb>>, key: string) {
  const belongs = (ticketKey: string) => ticketKey.startsWith(`${key}-`)
  await db.collection(COLLECTIONS.PROJECTS).deleteOne({ key })
  await db.collection(COLLECTIONS.TICKETS).deleteMany({ project_key: key })
  await db.collection(COLLECTIONS.COMMENTS).deleteMany({ ticket_key: { $regex: `^${key}-` } })
  await db.collection(COLLECTIONS.EVENTS).deleteMany({ project_key: key })
  const saved = await db.collection<{ _id: string; state?: BoardStateDoc }>("rest_state").findOne({ _id: "board" })
  if (!saved?.state) return
  saved.state.projects = saved.state.projects?.filter((project) => project.key !== key) ?? []
  saved.state.tickets = saved.state.tickets?.filter((ticket) => !belongs(ticket.key)) ?? []
  saved.state.comments = saved.state.comments?.filter((comment) => !belongs(comment.ticket_key)) ?? []
  saved.state.events = saved.state.events?.filter((event) => !belongs(event.ticket_key)) ?? []
  await db.collection<{ _id: string }>("rest_state").updateOne({ _id: "board" }, { $set: { state: saved.state } })
}

type BoardStateDoc = {
  projects?: { key: string }[]
  tickets?: { key: string }[]
  comments?: { ticket_key: string }[]
  events?: { ticket_key: string }[]
}

function validationDetails(error: unknown): unknown {
  if (!error || typeof error !== "object") return undefined
  const record = error as { errInfo?: unknown; errorResponse?: { errInfo?: unknown } }
  return record.errInfo ?? record.errorResponse?.errInfo
}

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : "Database request failed"
  const details = validationDetails(error)
  if (details) console.error("board validation", JSON.stringify(details))
  else if (message !== "MONGODB_URI is not set") console.error("board write", message)
  const status = message === "MONGODB_URI is not set" ? 503 : 500
  return NextResponse.json(
    { error: { code: details ? "document_failed_validation" : "database", message, ...(details ? { details } : {}) } },
    { status },
  )
}

async function rememberTicket(
  db: Awaited<ReturnType<typeof getDb>>,
  doc: {
    key: string
    title: string
    status: string
    created_by: unknown
    created_at: Date
    linked_commits?: unknown
  },
) {
  const saved = await db.collection<{ _id: string; revision?: number; state?: { tickets?: Record<string, unknown>[] } }>("rest_state").findOne({ _id: "board" })
  const tickets = saved?.state?.tickets
  if (!saved?.state || !tickets) return
  const patch = {
    key: doc.key,
    title: doc.title,
    status: doc.status,
    created_by: doc.created_by,
    created_at: doc.created_at.toISOString(),
    linked_commits: Array.isArray(doc.linked_commits) ? doc.linked_commits : [],
  }
  const index = tickets.findIndex((ticket) => ticket.key === doc.key)
  if (index >= 0) {
    const current: Record<string, unknown> = { ...tickets[index], ...patch }
    delete current.needs_approval
    delete current.approved_by
    delete current.approved_at
    delete current.deleted_at
    tickets[index] = current
  } else tickets.push(patch)
  const filter = typeof saved.revision === "number" ? { _id: "board", revision: saved.revision } : { _id: "board" }
  await db.collection<{ _id: string; revision?: number }>("rest_state").updateOne(filter, { $set: { "state.tickets": tickets } })
}

async function forgetTicket(db: Awaited<ReturnType<typeof getDb>>, key: string) {
  const saved = await db.collection<{
    _id: string
    state?: { tickets?: { key: string }[]; comments?: { ticket_key: string }[]; events?: { ticket_key: string }[] }
  }>("rest_state").findOne({ _id: "board" })
  if (!saved?.state) return
  const tickets = saved.state.tickets?.filter((ticket) => ticket.key !== key) ?? []
  const comments = saved.state.comments?.filter((comment) => comment.ticket_key !== key) ?? []
  const events = saved.state.events?.filter((event) => event.ticket_key !== key) ?? []
  await db.collection<{ _id: string }>("rest_state").updateOne(
    { _id: "board" },
    { $set: { "state.tickets": tickets, "state.comments": comments, "state.events": events } },
  )
}

function unknownField(record: object, allowed: Set<string>): string | undefined {
  return Object.keys(record).find((key) => !allowed.has(key))
}

export async function GET() {
  try {
    const db = await getDb()
    await ensureBoardSchema(db)
    const [projects, tickets, comments, events, agents, users, saved] = await Promise.all([
      db.collection(COLLECTIONS.PROJECTS).find({}, { projection: { _id: 0 } }).toArray(),
      db.collection(COLLECTIONS.TICKETS).find({}, { projection: { _id: 0 } }).toArray(),
      db.collection(COLLECTIONS.COMMENTS).find({}, { projection: { _id: 0 } }).toArray(),
      db.collection(COLLECTIONS.EVENTS).find({}, { projection: { _id: 0 } }).sort({ created_at: -1 }).toArray(),
      db.collection(COLLECTIONS.AGENTS).find({}).toArray(),
      db.collection(COLLECTIONS.USERS).find({}, { projection: { name: 1, auth_username: 1, team: 1 } }).toArray(),
      db.collection<{ _id: string; state?: unknown }>("rest_state").findOne({ _id: "board" }),
    ])
    const board = mergeBoardRecords(
      { projects, tickets, comments, events, agents },
      saved?.state,
      { users, agents },
    )
    return NextResponse.json(board, { headers: { "cache-control": "private, no-store" } })
  } catch (error) {
    return fail(error)
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      kind?: string
      key?: string
      projectKey?: string
      project?: Project
      ticket?: Ticket
      comment?: Comment
      event?: Event
      agent?: Agent
    }
    const db = await getDb()
    await ensureBoardSchema(db)
    if (body.kind === "allocateKey" && body.projectKey && /^[A-Z][A-Z0-9]{1,5}$/.test(body.projectKey)) {
      const key = await nextTicketKey(db, body.projectKey)
      return NextResponse.json({ key })
    } else if (body.kind === "deleteProject" && body.key && /^[A-Z][A-Z0-9]{1,5}$/.test(body.key)) {
      await deleteProjectDocs(db, body.key)
    } else if (body.kind === "deleteTicket" && body.key && /^[A-Z][A-Z0-9]{1,5}-\d+$/.test(body.key)) {
      const existing = await db.collection(COLLECTIONS.TICKETS).findOne({ key: body.key })
      if (!existing) {
        return NextResponse.json({ error: { code: "not_found", message: `Ticket ${body.key} was not found` } }, { status: 404 })
      }
      if (existing.deleted_at) {
        return NextResponse.json({ error: { code: "conflict", message: `Ticket ${body.key} is already deleted` } }, { status: 409 })
      }
      const result = await db.collection(COLLECTIONS.TICKETS).updateOne({ key: body.key }, { $set: { deleted_at: new Date() } })
      if (result.matchedCount !== 1) {
        return NextResponse.json({ error: { code: "not_found", message: `Ticket ${body.key} was not found` } }, { status: 404 })
      }
      await forgetTicket(db, body.key)
    } else if (body.kind === "project" && body.project) {
      const doc = projectDoc(body.project)
      await db.collection(COLLECTIONS.PROJECTS).replaceOne({ key: doc.key }, doc, { upsert: true })
    } else if (body.kind === "ticket" && body.ticket) {
      const extra = unknownField(body.ticket, TICKET_FIELDS)
      if (extra) {
        return NextResponse.json({ error: { code: "invalid_input", message: `Unknown field ${extra}` } }, { status: 400 })
      }
      const actorExtra = unknownField(body.ticket.created_by ?? {}, ACTOR_FIELDS)
      if (actorExtra) {
        return NextResponse.json({ error: { code: "invalid_input", message: `Unknown field created_by.${actorExtra}` } }, { status: 400 })
      }
      const doc = ticketDoc(body.ticket)
      const existing = await db.collection(COLLECTIONS.TICKETS).findOne({ key: doc.key })
      if (existing?.deleted_at) {
        return NextResponse.json({ error: { code: "conflict", message: `Ticket ${doc.key} is deleted` } }, { status: 409 })
      }
      await db.collection(COLLECTIONS.TICKETS).replaceOne({ key: doc.key }, doc, { upsert: true })
      await rememberTicket(db, doc)
    } else if (body.kind === "comment" && body.comment) {
      const doc = commentDoc(body.comment)
      await db.collection<{ _id: string }>(COLLECTIONS.COMMENTS).replaceOne({ _id: doc._id }, doc, { upsert: true })
    } else if (body.kind === "event" && body.event) {
      const doc = eventDoc(body.event)
      await db.collection<{ _id: string }>(COLLECTIONS.EVENTS).replaceOne({ _id: doc._id }, doc, { upsert: true })
    } else if (body.kind === "agent" && body.agent) {
      const doc = agentDoc(body.agent)
      await db.collection<{ _id: string }>(COLLECTIONS.AGENTS).replaceOne({ _id: doc._id }, doc, { upsert: true })
    } else {
      return NextResponse.json(
        { error: { code: "invalid_input", message: "Missing board document" } },
        { status: 400 }
      )
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    return fail(error)
  }
}
