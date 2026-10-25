import { NextResponse } from "next/server"

import { agentDoc, commentDoc, eventDoc, projectDoc, ticketDoc } from "@/lib/board-docs"
import { getDb } from "@/lib/mongodb"
import type { Agent, Comment, Event, Project, Ticket } from "@/lib/types"
import { COLLECTIONS } from "@/shared/names"

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

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : "Database request failed"
  const status = message === "MONGODB_URI is not set" ? 503 : 500
  return NextResponse.json({ error: { code: "database", message } }, { status })
}

export async function GET() {
  try {
    const db = await getDb()
    const [projects, tickets, comments, events, agents] = await Promise.all([
      db.collection(COLLECTIONS.PROJECTS).find({}, { projection: { _id: 0 } }).toArray(),
      db.collection(COLLECTIONS.TICKETS).find({}, { projection: { _id: 0 } }).toArray(),
      db.collection(COLLECTIONS.COMMENTS).find({}, { projection: { _id: 0 } }).toArray(),
      db.collection(COLLECTIONS.EVENTS).find({}, { projection: { _id: 0 } }).sort({ created_at: -1 }).toArray(),
      db.collection(COLLECTIONS.AGENTS).find({}).toArray(),
    ])
    return NextResponse.json({ projects, tickets, comments, events, agents })
  } catch (error) {
    return fail(error)
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      kind?: string
      key?: string
      project?: Project
      ticket?: Ticket
      comment?: Comment
      event?: Event
      agent?: Agent
    }
    const db = await getDb()
    if (body.kind === "deleteProject" && body.key && /^[A-Z][A-Z0-9]{1,5}$/.test(body.key)) {
      await deleteProjectDocs(db, body.key)
    } else if (body.kind === "deleteTicket" && body.key && /^[A-Z][A-Z0-9]{1,5}-\d+$/.test(body.key)) {
      await db.collection(COLLECTIONS.TICKETS).deleteOne({ key: body.key })
      await db.collection(COLLECTIONS.COMMENTS).deleteMany({ ticket_key: body.key })
    } else if (body.kind === "project" && body.project) {
      const doc = projectDoc(body.project)
      await db.collection(COLLECTIONS.PROJECTS).replaceOne({ key: doc.key }, doc, { upsert: true })
    } else if (body.kind === "ticket" && body.ticket) {
      const doc = ticketDoc(body.ticket)
      await db.collection(COLLECTIONS.TICKETS).replaceOne({ key: doc.key }, doc, { upsert: true })
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
