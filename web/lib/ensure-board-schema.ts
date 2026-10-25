import { Int32, type Db } from "mongodb"

import { validators } from "@/lib/board-validators.js"

let ready: Promise<void> | undefined

export function ensureBoardSchema(db: Db): Promise<void> {
  ready ??= applyBoardSchema(db).catch((error: unknown) => {
    ready = undefined
    throw error
  })
  return ready
}

async function applyBoardSchema(db: Db): Promise<void> {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((collection) => collection.name))
  for (const [name, schema] of Object.entries(validators)) {
    const rules = { validator: { $jsonSchema: schema }, validationLevel: "strict" as const, validationAction: "error" as const }
    if (existing.has(name)) await db.command({ collMod: name, ...rules })
    else await db.createCollection(name, rules)
  }
}

// The next ticket number for a project. findOneAndUpdate $inc is atomic, so
// two creates at the same time cannot take the same number.
export async function nextTicketKey(db: Db, project: string): Promise<string> {
  if (!/^[A-Z][A-Z0-9]{1,5}$/.test(project)) throw new Error("Project key must be 2–6 letters or numbers")
  const counters = db.collection<{ _id: string; seq: Int32 }>("ticket_counters")
  const tickets = await db.collection<{ key?: string }>("tickets").find({ project_key: project }, { projection: { key: 1 } }).toArray()
  const max = tickets.reduce((highest, ticket) => {
    const number = Number(String(ticket.key ?? "").split("-")[1])
    return Number.isInteger(number) && number > highest ? number : highest
  }, 0)
  await counters.updateOne({ _id: project }, { $max: { seq: new Int32(max) } }, { upsert: true })
  const updated = await counters.findOneAndUpdate({ _id: project }, { $inc: { seq: new Int32(1) } }, { returnDocument: "after" })
  const seq = Number(updated?.seq ?? 1)
  return `${project}-${String(seq).padStart(2, "0")}`
}
