// The org API (NSB-62 contract), called through the web app's /api/org/* proxy. Shapes match
// the contract exactly; anything malformed is dropped rather than shown. Members never carry
// emails; the only emails are the ones an admin typed into an invite, in the admin's invite list.
//
// Org-management calls name the org in the path and send only x-nutshell-org for it, never the
// active team, so the board checks the org the page is about. /me/* and /invites/* send no
// context at all. Dependency-free (no imports) so node --test can load it with a stubbed fetch.

export type OrgRole = "admin" | "member"
export type OrgTeam = { team_id: string; name: string; archived?: boolean }
export type OrgSummary = { org_id: string; name: string; role: OrgRole; default_team_id: string; teams: OrgTeam[] }
export type CreatedOrg = { org_id: string; name: string; team: OrgTeam }
export type OrgMemberRow = { user_id: string; username: string; name: string; role: OrgRole; teams: string[] }
export type InviteStatus = "pending" | "accepted" | "revoked" | "expired"
export type InviteRow = {
  invite_id: string
  email: string
  username: string | null
  role: OrgRole
  status: InviteStatus
  created_at: string
  expires_at: string
}
export type InvitePreview = { org_name: string; role: OrgRole; expires_at: string; email_matches: boolean }
export type MyInvite = { invite_id: string; org_name: string; role: OrgRole; expires_at: string }
export type Membership = { org_id: string; role: OrgRole; team_id: string; default_team: string; manager: boolean }

export class OrgApiError extends Error {
  readonly code: string
  readonly status: number
  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = "OrgApiError"
    this.code = code
    this.status = status
  }
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>

export type OrgApiDeps = {
  fetch: Fetch
  /** The signed-in session's bearer, or null when signed out. */
  secret: () => string | null
  base?: string
}

const str = (value: unknown) => (typeof value === "string" ? value : "")
const role = (value: unknown): OrgRole => (value === "admin" ? "admin" : "member")
const record = (value: unknown) =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null
const list = <T>(value: unknown, parse: (row: Record<string, unknown>) => T | null): T[] =>
  Array.isArray(value) ? value.flatMap((item) => {
    const row = record(item)
    const parsed = row ? parse(row) : null
    return parsed ? [parsed] : []
  }) : []

function parseTeam(row: Record<string, unknown>): OrgTeam | null {
  const team_id = str(row.team_id)
  return team_id ? { team_id, name: str(row.name), ...(row.archived === true ? { archived: true } : {}) } : null
}

export function parseOrgs(value: unknown): OrgSummary[] {
  return list(value, (row) => {
    const org_id = str(row.org_id)
    if (!org_id) return null
    return { org_id, name: str(row.name), role: role(row.role), default_team_id: str(row.default_team_id), teams: list(row.teams, parseTeam) }
  })
}

export function parseMembers(value: unknown): OrgMemberRow[] {
  return list(value, (row) => {
    const user_id = str(row.user_id)
    if (!user_id) return null
    const teams = Array.isArray(row.teams) ? row.teams.filter((team): team is string => typeof team === "string") : []
    // Emails are never shown for members, even if a row carried one.
    return { user_id, username: str(row.username), name: str(row.name) || str(row.username), role: role(row.role), teams }
  })
}

const STATUSES: InviteStatus[] = ["pending", "accepted", "revoked", "expired"]

export function parseInvites(value: unknown): InviteRow[] {
  return list(value, (row) => {
    const invite_id = str(row.invite_id)
    if (!invite_id) return null
    const status = STATUSES.find((s) => s === row.status) ?? "pending"
    return {
      invite_id,
      email: str(row.email),
      username: str(row.username) || null,
      role: role(row.role),
      status,
      created_at: str(row.created_at),
      expires_at: str(row.expires_at),
    }
  })
}

export function parseMyInvites(value: unknown): MyInvite[] {
  return list(value, (row) => {
    const invite_id = str(row.invite_id)
    return invite_id ? { invite_id, org_name: str(row.org_name), role: role(row.role), expires_at: str(row.expires_at) } : null
  })
}

/** "username — email — status": a pending row has no username until they accept. */
export function inviteRowParts(
  invite: Pick<InviteRow, "username" | "email" | "status">,
  text: { notJoined: string; states: Record<InviteStatus, string> }
): [string, string, string] {
  return [invite.username ?? text.notJoined, invite.email, text.states[invite.status]]
}

/** Revoke, Resend and Copy link only while it's pending (the board answers 409 otherwise). */
export const canRevoke = (invite: Pick<InviteRow, "status">) => invite.status === "pending"
export const canResend = (invite: Pick<InviteRow, "status">) => invite.status === "pending"

/**
 * Whether you may leave: anyone but an org's last admin. With the members list not loaded yet,
 * only a non-admin is cleared to leave; the board's 409 last_admin is the final word.
 */
export function leaveBlocked(myRole: OrgRole, myId: string, members: readonly Pick<OrgMemberRow, "user_id" | "role">[] | null): boolean {
  if (myRole !== "admin") return false
  if (!members) return true
  return !members.some((member) => member.role === "admin" && member.user_id !== myId)
}

/** The last admin can't be removed either. */
export function removeBlocked(target: Pick<OrgMemberRow, "user_id" | "role">, members: readonly Pick<OrgMemberRow, "user_id" | "role">[]): boolean {
  return target.role === "admin" && !members.some((member) => member.role === "admin" && member.user_id !== target.user_id)
}

const TOKEN = /^nsi_[A-Za-z0-9_-]{16,200}$/

export function validInviteToken(token: string): boolean {
  return TOKEN.test(token)
}

/**
 * The invite token from the accept page's address: /invite#nsi_… (the fragment never reaches a
 * server or a referrer), or ?token=nsi_… if the board hands out a link in that form.
 */
export function tokenFromLocation(hash: string, search: string): string {
  const fromHash = hash.replace(/^#/, "")
  const hashToken = fromHash.startsWith("token=") ? new URLSearchParams(fromHash).get("token") ?? "" : decodeURIComponent(fromHash)
  if (validInviteToken(hashToken)) return hashToken
  const queryToken = new URLSearchParams(search).get("token") ?? ""
  return validInviteToken(queryToken) ? queryToken : ""
}

/**
 * What the admin copies in link mode. The board hands back the raw nsi_ token; the address puts
 * it in the fragment (/invite#nsi_…), which browsers never send to a server or in a referrer, so
 * it stays out of logs. A full address from the board is used as is.
 */
export function inviteUrl(link: string, origin: string): string {
  if (/^https?:\/\//.test(link)) return link
  return `${origin.replace(/\/+$/, "")}/invite#${link}`
}

/** 1 to 14 whole days; anything else is the default 7. */
export function clampExpiryDays(days: number, limits = { MIN: 1, MAX: 14, DEFAULT: 7 }): number {
  return Number.isInteger(days) && days >= limits.MIN && days <= limits.MAX ? days : limits.DEFAULT
}

/** A plain shape check, not deliverability: the board answers the same whatever the address. */
export function plausibleEmail(email: string): boolean {
  return /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,63}$/.test(email.trim()) && email.trim().length <= 254
}

export function validOrgName(name: string): boolean {
  const trimmed = name.trim()
  return trimmed.length >= 1 && trimmed.length <= 60
}

const ORG_HEADER = "x-nutshell-org"

export function createOrgApi(deps: OrgApiDeps) {
  const base = deps.base ?? "/api/org"

  async function call(path: string, init: { method?: string; body?: unknown; org?: string } = {}): Promise<unknown> {
    const secret = deps.secret()
    if (!secret) throw new OrgApiError("unauthorized", "Sign in first", 401)
    const headers: Record<string, string> = { accept: "application/json", authorization: `Bearer ${secret}` }
    if (init.body !== undefined) headers["content-type"] = "application/json"
    if (init.org) headers[ORG_HEADER] = encodeURIComponent(init.org)
    let response: Response
    try {
      response = await deps.fetch(`${base}/${path}`, {
        method: init.method ?? "GET",
        headers,
        cache: "no-store",
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      })
    } catch {
      throw new OrgApiError("board_unavailable", "Couldn't reach the board. Check your connection and try again.", 503)
    }
    const text = await response.text().catch(() => "")
    let body: unknown = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = null
    }
    if (!response.ok) {
      const error = record(record(body)?.error) ?? {}
      const code = str(error.code) || str(record(body)?.error) || "request_failed"
      throw new OrgApiError(code, str(error.message) || response.statusText || "Request failed", response.status)
    }
    return body
  }

  const org = (id: string) => `orgs/${encodeURIComponent(id)}`

  return {
    myOrgs: async () => parseOrgs(await call("me/orgs")),
    membership: async (team?: string): Promise<Membership | null> => {
      const row = record(await call(team ? `me/membership?team=${encodeURIComponent(team)}` : "me/membership"))
      if (!row || !str(row.org_id)) return null
      const team_row = record(row.team)
      return { org_id: str(row.org_id), role: role(row.role), team_id: str(team_row?.team_id), default_team: str(row.default_team), manager: team_row?.manager === true }
    },
    createOrg: async (name: string): Promise<CreatedOrg> => {
      const row = record(await call("orgs", { method: "POST", body: { name: name.trim() } }))
      const team = record(row?.team)
      const created = { org_id: str(row?.org_id), name: str(row?.name), team: { team_id: str(team?.team_id), name: str(team?.name) } }
      if (!created.org_id) throw new OrgApiError("request_failed", "The board returned an unexpected response", 502)
      return created
    },
    updateOrg: async (id: string, patch: { name?: string; token_expiry_hours?: number }) =>
      record(await call(org(id), { method: "PATCH", body: patch, org: id })),
    members: async (id: string) => parseMembers(await call(`${org(id)}/members`, { org: id })),
    removeMember: async (id: string, userId: string) => {
      await call(`${org(id)}/members/${encodeURIComponent(userId)}`, { method: "DELETE", org: id })
    },
    leave: async (id: string) => {
      await call(`${org(id)}/leave`, { method: "POST", org: id })
    },
    invite: async (id: string, input: { email: string; role: OrgRole; expires_days: number }) => {
      const row = record(
        await call(`${org(id)}/invites`, {
          method: "POST",
          org: id,
          body: { email: input.email.trim(), role: input.role, expires_days: clampExpiryDays(input.expires_days) },
        })
      )
      return { invite_id: str(row?.invite_id), link: str(row?.link) || null }
    },
    invites: async (id: string) => parseInvites(await call(`${org(id)}/invites`, { org: id })),
    revokeInvite: async (id: string, inviteId: string) => {
      await call(`${org(id)}/invites/${encodeURIComponent(inviteId)}/revoke`, { method: "POST", org: id })
    },
    resendInvite: async (id: string, inviteId: string) => {
      const row = record(await call(`${org(id)}/invites/${encodeURIComponent(inviteId)}/resend`, { method: "POST", org: id }))
      return { link: str(row?.link) || null }
    },
    previewInvite: async (token: string): Promise<InvitePreview> => {
      const row = record(await call(`invites/preview?token=${encodeURIComponent(token)}`))
      return { org_name: str(row?.org_name), role: role(row?.role), expires_at: str(row?.expires_at), email_matches: row?.email_matches === true }
    },
    acceptInvite: async (token: string, teamId?: string) => {
      const row = record(await call("invites/accept", { method: "POST", body: { token, ...(teamId ? { team_id: teamId } : {}) } }))
      return { org_id: str(row?.org_id), team_id: str(row?.team_id) }
    },
    myInvites: async () => parseMyInvites(await call("me/invites")),
    startEmail: async (email: string) => {
      await call("me/email", { method: "POST", body: { email: email.trim() } })
    },
    verifyEmail: async (code: string) => {
      const row = record(await call("me/email/verify", { method: "POST", body: { code: code.trim() } }))
      return row?.verified === true
    },
  }
}

export type OrgApi = ReturnType<typeof createOrgApi>
