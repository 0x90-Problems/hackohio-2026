import { NextResponse } from "next/server"

import { agentDoc, commentDoc, eventDoc, projectDoc, ticketDoc } from "@/lib/board-docs"
import { getDb } from "@/lib/mongodb"
import type { Agent, Comment, Event, Project, Ticket } from "@/lib/types"
import { COLLECTIONS } from "@/shared/names"

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
      project?: Project
      ticket?: Ticket
      comment?: Comment
      event?: Event
      agent?: Agent
    }
    const db = await getDb()
    if (body.kind === "project" && body.project) {
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
