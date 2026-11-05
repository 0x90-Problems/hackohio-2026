// Multiple organizations (NSB-62), behind NEXT_PUBLIC_MULTI_ORG. Someone in several orgs works
// in one org and one of its teams at a time. The choice is per browser (localStorage); every
// board, files, chat, whiteboard and documents call says which team it means with
// x-nutshell-team (or x-nutshell-org before a team is picked), and each service checks it.
// Header names match ORG_HEADERS in shared/names.ts.
//
// Dependency-free (no imports) so node --test can load it.

export const ORG_CHOICE_KEY = "nutshell.active-org"

const TEAM_HEADER = "x-nutshell-team"
const ORG_HEADER = "x-nutshell-org"

/** The flag. Off unless NEXT_PUBLIC_MULTI_ORG is "1", "true" or "on"; off means today's UI exactly. */
export function multiOrgOn(raw: string | undefined = process.env.NEXT_PUBLIC_MULTI_ORG): boolean {
  const value = raw?.trim().toLowerCase()
  return value === "1" || value === "true" || value === "on"
}

export type OrgChoice = { org: string; team: string }

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">

const ID = /^[A-Za-z0-9_-]{1,64}$/

function clean(value: unknown): string {
  return typeof value === "string" && ID.test(value) ? value : ""
}

export function readOrgChoice(store: Store | null | undefined): OrgChoice | null {
  try {
    const raw = store?.getItem(ORG_CHOICE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { org?: unknown; team?: unknown }
    const choice = { org: clean(parsed.org), team: clean(parsed.team) }
    return choice.org ? choice : null
  } catch {
    return null // private window, blocked storage or a damaged value: the server's default
  }
}

export function writeOrgChoice(store: Store | null | undefined, choice: OrgChoice | null): void {
  try {
    if (!choice?.org) store?.removeItem(ORG_CHOICE_KEY)
    else store?.setItem(ORG_CHOICE_KEY, JSON.stringify({ org: choice.org, team: choice.team }))
  } catch {
    // the switch just won't stick
  }
}

/** The headers that say where a call is for: the team, or the org when no team is picked. */
export function contextHeaders(choice: OrgChoice | null): Record<string, string> {
  if (choice?.team) return { [TEAM_HEADER]: encodeURIComponent(choice.team) }
  if (choice?.org) return { [ORG_HEADER]: encodeURIComponent(choice.org) }
  return {}
}

/** Only for one org (org-management calls name the org in the path, and never a team elsewhere). */
export function orgOnlyHeaders(orgId: string): Record<string, string> {
  return orgId ? { [ORG_HEADER]: encodeURIComponent(orgId) } : {}
}

type OrgTeams = { org_id: string; default_team_id?: string | null; teams: { team_id: string }[] }

/**
 * Checks a stored choice against the orgs someone is actually in (GET /me/orgs). A stored org
 * they've left falls back to `hint` (the server's default from /me/membership), then the first
 * org; a team outside the org falls back to the org's default team, then its first.
 */
export function resolveChoice(
  orgs: readonly OrgTeams[],
  stored: OrgChoice | null,
  hint: OrgChoice | null = null
): OrgChoice | null {
  if (orgs.length === 0) return null
  const byId = (id: string | undefined) => (id ? orgs.find((org) => org.org_id === id) : undefined)
  const org = byId(stored?.org) ?? byId(hint?.org) ?? orgs[0]
  const has = (id: string | null | undefined) => Boolean(id) && org.teams.some((team) => team.team_id === id)
  const wanted = org.org_id === stored?.org ? stored.team : org.org_id === hint?.org ? hint.team : ""
  const team = has(wanted) ? wanted : has(org.default_team_id) ? (org.default_team_id as string) : (org.teams[0]?.team_id ?? "")
  return { org: org.org_id, team }
}

export function sameChoice(a: OrgChoice | null, b: OrgChoice | null): boolean {
  return (a?.org ?? "") === (b?.org ?? "") && (a?.team ?? "") === (b?.team ?? "")
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>

/**
 * fetch for the team you're working in. If you've since left that team (403 not_on_team), the
 * team is dropped from the choice and the call is retried for the org, or for your default.
 */
export async function contextFetch(
  fetcher: Fetch,
  url: string,
  init: RequestInit & { headers: Record<string, string> },
  choice: OrgChoice | null,
  onStale: (next: OrgChoice | null) => void
): Promise<Response> {
  const headers = contextHeaders(choice)
  if (Object.keys(headers).length === 0) return fetcher(url, init)
  const response = await fetcher(url, { ...init, headers: { ...init.headers, ...headers } })
  if (response.status !== 403 || !choice?.team) return response
  const body = (await response.clone().json().catch(() => null)) as { error?: string | { code?: string } } | null
  const code = typeof body?.error === "string" ? body.error : body?.error?.code
  if (code !== "not_on_team") return response
  const next = { org: choice.org, team: "" }
  onStale(next)
  return fetcher(url, { ...init, headers: { ...init.headers, ...contextHeaders(next) } })
}
