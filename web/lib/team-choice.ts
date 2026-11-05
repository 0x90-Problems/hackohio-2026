"use client"

import {
  contextFetch,
  contextHeaders,
  multiOrgOn,
  readOrgChoice,
  writeOrgChoice,
  type OrgChoice,
} from "@/lib/org-choice"

// Someone on several teams works in one at a time. The choice is per browser; each request
// says which team it means, and each service checks they're actually on it.
// With NEXT_PUBLIC_MULTI_ORG on, the choice is an org and a team id (lib/org-choice.ts) instead
// of a team name, and board calls carry it too.

const KEY = "nutshell.active-team"

function storage(): Storage | null {
  try {
    return localStorage
  } catch {
    return null
  }
}

/** The active org and team ids. Null with the flag off, or before anything is picked. */
export function activeOrgChoice(): OrgChoice | null {
  return multiOrgOn() ? readOrgChoice(storage()) : null
}

export function chooseOrg(choice: OrgChoice | null) {
  writeOrgChoice(storage(), choice)
}

export function activeTeam(): string {
  if (multiOrgOn()) return activeOrgChoice()?.team ?? ""
  try {
    return localStorage.getItem(KEY) ?? ""
  } catch {
    return "" // private window or blocked storage: their default team
  }
}

export function chooseTeam(team: string) {
  if (multiOrgOn()) {
    const current = activeOrgChoice()
    if (current) chooseOrg({ org: current.org, team })
    return
  }
  try {
    localStorage.setItem(KEY, team)
  } catch {
    // the switch just won't stick
  }
}

function clearTeam() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // nothing stored to clear
  }
}

/** Headers for board API calls: the active team or org with the flag on, nothing with it off. */
export function boardContextHeaders(): Record<string, string> {
  return multiOrgOn() ? contextHeaders(activeOrgChoice()) : {}
}

/** fetch, for the team you're working in. If you've since left that team, falls back to your default. */
export async function teamFetch(url: string, init: RequestInit & { headers: Record<string, string> }): Promise<Response> {
  if (multiOrgOn()) return contextFetch(fetch, url, init, activeOrgChoice(), chooseOrg)
  const team = activeTeam()
  if (!team) return fetch(url, init)
  const response = await fetch(url, { ...init, headers: { ...init.headers, "x-nutshell-team": encodeURIComponent(team) } })
  if (response.status !== 403) return response
  const body = (await response.clone().json().catch(() => null)) as { error?: string | { code?: string } } | null
  const code = typeof body?.error === "string" ? body.error : body?.error?.code
  if (code !== "not_on_team") return response
  clearTeam()
  return fetch(url, init)
}
