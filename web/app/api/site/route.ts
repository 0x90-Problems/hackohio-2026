import { NextResponse } from "next/server"

import { getDb } from "@/lib/mongodb"

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : "Database request failed"
  const status = message === "MONGODB_URI is not set" ? 503 : 500
  return NextResponse.json({ error: { code: "database", message } }, { status })
}

export async function GET() {
  try {
    const db = await getDb()
    const [organization, teams, apiKeys, users] = await Promise.all([
      db.collection<{ _id: string }>("organization").findOne({ _id: "settings" }, { projection: { _id: 0 } }),
      db.collection("teams").find({}, { projection: { _id: 0 } }).toArray(),
      db.collection("api_keys").find({}, { projection: { _id: 0 } }).toArray(),
      db.collection("users").find().toArray(),
    ])
    return NextResponse.json({
      organization: organization ?? null,
      teams,
      apiKeys,
      users,
    })
  } catch (error) {
    return fail(error)
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      kind?: string
      organization?: { name: string; token_expiry_hours: number; rules: Record<string, boolean> }
      team?: { name: string }
      apiKey?: {
        id?: string
        name: string
        owner_id: string
        token_prefix: string
        last_used_at: string | null
        scopes: string[]
        revoked?: boolean
      }
      user?: { _id: string; auth_username: string; name: string; role?: string; team: string }
    }
    const db = await getDb()
    if (body.kind === "organization" && body.organization?.name) {
      await db.collection<{ _id: string }>("organization").replaceOne(
        { _id: "settings" },
        { _id: "settings", ...body.organization },
        { upsert: true }
      )
    } else if (body.kind === "team" && body.team?.name) {
      const name = body.team.name.trim()
      await db.collection<{ _id: string }>("teams").replaceOne({ _id: name }, { _id: name, name }, { upsert: true })
    } else if (body.kind === "apiKey" && body.apiKey?.token_prefix) {
      const key = body.apiKey
      await db.collection<{ _id: string }>("api_keys").replaceOne(
        { _id: `${key.owner_id}:${key.token_prefix}:${key.name}` },
        {
          _id: `${key.owner_id}:${key.token_prefix}:${key.name}`,
          ...(key.id ? { id: key.id } : {}),
          name: key.name,
          owner_id: key.owner_id,
          token_prefix: key.token_prefix,
          last_used_at: key.last_used_at ? new Date(key.last_used_at) : null,
          scopes: key.scopes,
          revoked: key.revoked === true,
        },
        { upsert: true }
      )
    } else if (body.kind === "user" && body.user?._id && body.user.auth_username && body.user.name && body.user.team) {
      const user = body.user
      await db.collection<{ _id: string }>("users").replaceOne(
        { _id: user._id },
        {
          _id: user._id,
          auth_username: user.auth_username,
          name: user.name,
          ...(user.role ? { role: user.role } : {}),
          team: user.team,
          type: "human",
        },
        { upsert: true }
      )
    } else {
      return NextResponse.json(
        { error: { code: "invalid_input", message: "Missing site document" } },
        { status: 400 }
      )
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    return fail(error)
  }
}
