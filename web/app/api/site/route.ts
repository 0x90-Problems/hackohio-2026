import { NextResponse } from "next/server"

import { proxyBoard } from "@/lib/board-proxy"

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * Teams / Organization / API keys path after Atlas shutdown.
 * Proxies to the AWS board API (DocumentDB). No MONGODB_URI on Vercel.
 * Clients must send Authorization: Bearer <session secret> (same token as login).
 */

type SitePostBody = {
  kind?: string
  organization?: { name: string; token_expiry_hours: number; rules: Record<string, boolean> }
  team?: { name: string; rename_from?: string }
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

async function boardJson(request: Request, path: string, init?: { method?: string; body?: unknown }) {
  const headers = new Headers()
  headers.set("accept", "application/json")
  const authorization = request.headers.get("authorization")
  if (authorization) headers.set("authorization", authorization)
  if (init?.body !== undefined) headers.set("content-type", "application/json")
  const upstream = await proxyBoard(
    new Request(request.url, {
      method: init?.method ?? "GET",
      headers,
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    }),
    path,
  )
  const text = await upstream.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { error: { code: "board_unavailable", message: text || "Board returned non-JSON" } }
  }
  return { status: upstream.status, json }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

export async function GET(request: Request) {
  if (!request.headers.get("authorization")) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Sign in to load site settings" } },
      { status: 401 },
    )
  }

  const [organization, teams, users, agents] = await Promise.all([
    boardJson(request, "/organization"),
    boardJson(request, "/teams"),
    boardJson(request, "/users"),
    boardJson(request, "/agents"),
  ])

  for (const part of [organization, teams, users, agents]) {
    if (part.status >= 400) {
      return NextResponse.json(part.json ?? { error: { code: "database", message: "Board request failed" } }, {
        status: part.status,
      })
    }
  }

  const org = asRecord(organization.json)
  const teamList = Array.isArray(teams.json) ? teams.json : []
  const userList = Array.isArray(users.json) ? users.json : []
  const agentList = Array.isArray(agents.json) ? agents.json : []

  // API keys previously lived in Atlas `api_keys`. Board agents with an API-key
  // connection are the surviving source; prefixes stay on token create responses.
  const apiKeys = agentList.flatMap((item) => {
    const agent = asRecord(item)
    if (!agent || agent.revoked === true) return []
    if (agent.connection !== "api_key") return []
    const id = typeof agent._id === "string" ? agent._id : undefined
    const name = typeof agent.name === "string" ? agent.name : "Agent"
    const owner_id = typeof agent.owner_id === "string" ? agent.owner_id : ""
    const scopes = Array.isArray(agent.scopes) ? agent.scopes.filter((scope): scope is string => typeof scope === "string") : []
    return [
      {
        ...(id ? { id } : {}),
        name,
        owner_id,
        token_prefix: typeof agent.token_prefix === "string" ? agent.token_prefix : "",
        last_used_at: null,
        scopes,
        revoked: false,
      },
    ]
  })

  return NextResponse.json({
    organization: org
      ? {
          name: typeof org.name === "string" ? org.name : "Organization",
          token_expiry_hours: typeof org.token_expiry_hours === "number" ? org.token_expiry_hours : 24,
          rules:
            org.rules && typeof org.rules === "object" && !Array.isArray(org.rules)
              ? (org.rules as Record<string, boolean>)
              : {},
        }
      : null,
    teams: teamList.flatMap((item) => {
      const team = asRecord(item)
      const name = typeof team?.name === "string" ? team.name : ""
      return name ? [{ name }] : []
    }),
    apiKeys,
    users: userList.flatMap((item) => {
      const user = asRecord(item)
      if (!user) return []
      const _id = typeof user._id === "string" ? user._id : ""
      const auth_username = typeof user.auth_username === "string" ? user.auth_username : ""
      const name = typeof user.name === "string" ? user.name : ""
      const team = typeof user.team === "string" ? user.team : ""
      if (!_id || !auth_username || !name || !team) return []
      return [
        {
          _id,
          auth_username,
          name,
          ...(typeof user.role === "string" ? { role: user.role } : {}),
          team,
        },
      ]
    }),
  })
}

export async function POST(request: Request) {
  if (!request.headers.get("authorization")) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Sign in to change site settings" } },
      { status: 401 },
    )
  }

  let body: SitePostBody
  try {
    body = (await request.json()) as SitePostBody
  } catch {
    return NextResponse.json({ error: { code: "invalid_input", message: "Body must be JSON" } }, { status: 400 })
  }

  if (body.kind === "organization" && body.organization?.name) {
    const result = await boardJson(request, "/organization", {
      method: "PATCH",
      body: {
        name: body.organization.name,
        token_expiry_hours: body.organization.token_expiry_hours,
        rules: body.organization.rules,
      },
    })
    if (result.status >= 400) {
      return NextResponse.json(result.json ?? { error: { code: "database", message: "Could not save organization" } }, {
        status: result.status,
      })
    }
    return NextResponse.json({ ok: true })
  }

  if (body.kind === "team" && body.team?.name && body.team.rename_from) {
    // Renaming moves every member on the board; Folders follow via previous_names.
    const result = await boardJson(request, "/teams/rename", {
      method: "POST",
      body: { from: body.team.rename_from, to: body.team.name },
    })
    if (result.status >= 400) {
      return NextResponse.json(result.json ?? { error: { code: "database", message: "Could not rename the team" } }, {
        status: result.status,
      })
    }
    return NextResponse.json({ ok: true })
  }

  if (body.kind === "team" && body.team?.name) {
    // Board teams are derived from each user's `team` field — there is no empty-team store.
    // Acknowledge so the UI can keep the name locally until a member joins.
    return NextResponse.json({ ok: true, derived: true })
  }

  if (body.kind === "apiKey" && body.apiKey?.name) {
    if (body.apiKey.revoked === true && body.apiKey.id) {
      const result = await boardJson(request, `/agents/${encodeURIComponent(body.apiKey.id)}/revoke`, {
        method: "POST",
        body: {},
      })
      if (result.status >= 400) {
        return NextResponse.json(result.json ?? { error: { code: "database", message: "Could not revoke API key" } }, {
          status: result.status,
        })
      }
      return NextResponse.json({ ok: true })
    }
    const result = await boardJson(request, "/agents", {
      method: "POST",
      body: {
        name: body.apiKey.name,
        scopes: body.apiKey.scopes?.length ? body.apiKey.scopes : ["tickets:read", "tickets:write"],
        connection: "api_key",
      },
    })
    if (result.status >= 400) {
      return NextResponse.json(result.json ?? { error: { code: "database", message: "Could not create API key" } }, {
        status: result.status,
      })
    }
    return NextResponse.json({ ok: true })
  }

  if (body.kind === "user" && body.user?._id) {
    // Profile writes go through signup/login; board has no user PATCH.
    return NextResponse.json({ ok: true, derived: true })
  }

  return NextResponse.json({ error: { code: "invalid_input", message: "Missing site document" } }, { status: 400 })
}
