"use client"

// Someone on several teams works in one at a time. The choice is per browser; each request
// says which team it means, and each service checks they're actually on it.

const KEY = "nutshell.active-team"

export function activeTeam(): string {
  try {
    return localStorage.getItem(KEY) ?? ""
  } catch {
    return "" // private window or blocked storage: their default team
  }
}

export function chooseTeam(team: string) {
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

/** fetch, for the team you're working in. If you've since left that team, falls back to your default. */
export async function teamFetch(url: string, init: RequestInit & { headers: Record<string, string> }): Promise<Response> {
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
