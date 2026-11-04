// Who is in the organization, for the Organization page: the counts, each person's role,
// teams and agents, and when they were last active. All from the board, never mock data.

import type { SiteState } from "@/lib/site-db"
import type { Actor } from "@/lib/types"

type Person = SiteState["users"][number]
type Team = SiteState["teams"][number]
// `last_used_at` only comes from boards that record agent use; without it we use the activity log.
type OrgAgent = { _id: string; owner_id: string; revoked: boolean; last_used_at?: Date | string | null }
type Trace = { actor?: Actor; author?: Actor; created_by?: Actor; created_at: Date }

export type OrgRole = "admin" | "manager" | "member"

export const ROLE_LABELS: Record<OrgRole, string> = {
  admin: "Org admin",
  manager: "Team manager",
  member: "Member",
}

// Accounts from before multiple teams only have `team`.
export const teamsOf = (person: Pick<Person, "team" | "teams">) => person.teams ?? (person.team ? [person.team] : [])

const liveAgents = <A extends OrgAgent>(agents: readonly A[]) => agents.filter((agent) => !agent.revoked)

/** Teams = every team on the board plus any older team name someone still carries. Agents = not revoked. */
export function orgCounts(site: Pick<SiteState, "teams" | "users">, agents: readonly OrgAgent[]) {
  const teams = new Set([...site.teams.map((team) => team.name), ...site.users.flatMap(teamsOf)])
  return { teams: teams.size, people: site.users.length, agents: liveAgents(agents).length }
}

/** Org admin beats team manager beats member. */
export function roleOf(person: Pick<Person, "_id" | "admin">, teams: readonly Team[]): OrgRole {
  if (person.admin) return "admin"
  return teams.some((team) => team.managers.includes(person._id)) ? "manager" : "member"
}

// The person behind an actor: the human, or the person an agent acts for.
const personOf = (actor: Actor) => ("acting_for" in actor ? actor.acting_for : actor.id)

const toTime = (value: Date | string | null | undefined) => {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

/** Latest thing they or their agents did that the board knows of, or null when nothing says. */
export function lastActiveOf(personId: string, traces: readonly Trace[], agents: readonly OrgAgent[]) {
  let latest = 0
  for (const trace of traces) {
    const actor = trace.actor ?? trace.author ?? trace.created_by
    if (actor && personOf(actor) === personId) latest = Math.max(latest, toTime(trace.created_at))
  }
  for (const agent of agents) {
    if (agent.owner_id === personId) latest = Math.max(latest, toTime(agent.last_used_at))
  }
  return latest ? new Date(latest) : null
}

export type OrgMember = {
  person: Person
  role: OrgRole
  teams: string[]
  managerOf: string[]
  agents: number
  lastActive: Date | null
}

/** Everyone in the org: admins first, then managers, then members, each alphabetical. */
export function orgMembers(
  site: Pick<SiteState, "teams" | "users">,
  agents: readonly OrgAgent[],
  traces: readonly Trace[] = []
): OrgMember[] {
  const live = liveAgents(agents)
  const order: OrgRole[] = ["admin", "manager", "member"]
  return site.users
    .map((person) => ({
      person,
      role: roleOf(person, site.teams),
      teams: teamsOf(person),
      managerOf: site.teams.filter((team) => team.managers.includes(person._id)).map((team) => team.name),
      agents: live.filter((agent) => agent.owner_id === person._id).length,
      lastActive: lastActiveOf(person._id, traces, agents),
    }))
    .sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role) || a.person.name.localeCompare(b.person.name))
}
