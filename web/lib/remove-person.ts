// Removing someone from the organization: who may, and what the confirm dialog says.
// The same rules as the board API (removeMember in the backend). The board still decides,
// so this only avoids offering what it would refuse.

import type { SiteState } from "@/lib/site-db"

type Person = SiteState["users"][number]

/** Org admins only; never yourself, and never the last admin. */
export function canRemovePerson(person: Person, users: readonly Person[], myId: string | undefined, adminInSession: boolean) {
  if (!adminInSession || !myId || person._id === myId) return false
  if (person.admin && !users.some((user) => user._id !== person._id && user.admin)) return false
  return true
}

export type RemovalCounts = { agents: number; tokens: number }

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

/** What stops working, for the confirm dialog. Null counts mean the board didn't say. */
export function removalSummary(name: string, counts: RemovalCounts | null) {
  const what = counts
    ? counts.agents === 0 && counts.tokens === 0
      ? `${name} has no agents or live tokens.`
      : `${plural(counts.agents, "agent", "agents")} and ${plural(counts.tokens, "token", "tokens")} stop working right away.`
    : "Their agents and tokens stop working right away."
  return `${what} ${name} comes off every team and can't sign in again. Tickets, comments and files keep their name.`
}
