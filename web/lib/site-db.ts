"use client"

import { toast } from "sonner"

import { readSession } from "@/lib/board-auth"
import { reviveValue } from "@/lib/local-store"

export type SiteOrganization = {
  name: string
  token_expiry_hours: number
  rules: Record<string, boolean>
}

export type SiteApiKey = {
  id?: string
  name: string
  owner_id: string
  token_prefix: string
  last_used_at: Date | null
  scopes: string[]
  revoked?: boolean
}

export type SiteState = {
  organization: SiteOrganization | null
  teams: { name: string }[]
  apiKeys: SiteApiKey[]
  users: { _id: string; auth_username: string; name: string; role?: string; team: string }[]
}

const EMPTY: SiteState = { organization: null, teams: [], apiKeys: [], users: [] }

function authHeaders(extra?: HeadersInit): HeadersInit {
  const session = readSession()
  return {
    ...(extra ?? {}),
    ...(session?.secret ? { authorization: `Bearer ${session.secret}` } : {}),
  }
}

export async function loadSite(): Promise<SiteState> {
  // DocDB is VPC-only — unsigned visitors get empty Teams/Org until login.
  if (!readSession()?.secret) return EMPTY
  const response = await fetch("/api/site", { cache: "no-store", headers: authHeaders() })
  const body = (await response.json()) as SiteState & { error?: { message?: string } }
  if (!response.ok) throw new Error(body.error?.message ?? "Could not load site settings")
  return reviveValue({
    organization: body.organization ?? null,
    teams: body.teams ?? [],
    apiKeys: body.apiKeys ?? [],
    users: body.users ?? [],
  })
}

async function save(body: object) {
  const response = await fetch("/api/site", {
    method: "POST",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
    throw new Error(payload?.error?.message ?? "Could not save to the database")
  }
}

function report(error: unknown) {
  toast.error("Couldn't save to the database", {
    description: error instanceof Error ? error.message : undefined,
  })
}

export function saveOrganization(organization: SiteOrganization) {
  void save({ kind: "organization", organization }).catch(report)
}

export function saveTeam(name: string) {
  void save({ kind: "team", team: { name } }).catch(report)
}

export function saveApiKey(apiKey: SiteApiKey) {
  void save({
    kind: "apiKey",
    apiKey: {
      ...apiKey,
      last_used_at: apiKey.last_used_at ? apiKey.last_used_at.toISOString() : null,
      revoked: apiKey.revoked === true,
    },
  }).catch(report)
}

export function saveUser(user: SiteState["users"][number]) {
  void save({ kind: "user", user }).catch(report)
}
