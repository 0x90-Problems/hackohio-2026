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
  teams: { name: string; managers: string[]; created_by?: string }[]
  apiKeys: SiteApiKey[]
  users: { _id: string; auth_username: string; name: string; role?: string; admin?: boolean; team: string; teams?: string[] }[]
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

// Throws with the board's message (e.g. "A team named X already exists").
export function renameTeam(from: string, to: string) {
  return save({ kind: "team", team: { name: to, rename_from: from } })
}

// These throw with the board's message so the Teams page can show it.
export function createTeam(name: string) {
  return save({ kind: "team", team: { name } })
}

export function addTeamMember(team: string, userId: string) {
  return save({ kind: "member", member: { team, user_id: userId } })
}

export function removeTeamMember(team: string, userId: string) {
  return save({ kind: "member", member: { team, user_id: userId, remove: true } })
}

export function setTeamManager(team: string, userId: string, manager: boolean) {
  return save({ kind: "manager", manager: { team, user_id: userId, manager } })
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
