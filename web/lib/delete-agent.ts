// Deleting an agent or API key for good, and cleaning up your inactive ones.
// The same rules as the board API (DELETE /agents in the backend). The board still decides,
// so this only avoids offering what it would refuse. Pure so it can be unit tested.

/** One row of a DELETE /agents/:id or DELETE /agents?state=inactive answer. */
export type DeletedAgent = {
  agent_id: string
  name: string
  owner_id: string
  connection: string
  /** How many tokens went with it. */
  tokens: number
}

export type AgentCleanup = { dry_run: boolean; count: number; agents: DeletedAgent[] }

/** The owner or an org admin. Anyone else gets 403 from the board. */
export function canDeleteAgent(ownerId: string, myId: string | undefined, admin: boolean): boolean {
  if (!myId) return false
  return ownerId === myId || admin
}

export function parseDeletedAgent(value: unknown): DeletedAgent | null {
  if (value === null || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  if (typeof row.agent_id !== "string" || !row.agent_id) return null
  return {
    agent_id: row.agent_id,
    name: typeof row.name === "string" ? row.name : "",
    owner_id: typeof row.owner_id === "string" ? row.owner_id : "",
    connection: typeof row.connection === "string" ? row.connection : "",
    tokens: typeof row.tokens === "number" && Number.isFinite(row.tokens) ? row.tokens : 0,
  }
}

export function parseCleanup(value: unknown): AgentCleanup | null {
  if (value === null || typeof value !== "object") return null
  const body = value as Record<string, unknown>
  if (typeof body.dry_run !== "boolean" || !Array.isArray(body.agents)) return null
  const agents = body.agents.flatMap((row) => {
    const parsed = parseDeletedAgent(row)
    return parsed ? [parsed] : []
  })
  return { dry_run: body.dry_run, count: agents.length, agents }
}

/**
 * Splits a cleanup list into this page's rows and the other page's. The board cleans up both
 * kinds in one call, so the dialog has to say what else goes. A row with no connection is `missing`.
 */
export function splitCleanup(agents: readonly DeletedAgent[], wanted: string, missing: string) {
  const here: DeletedAgent[] = []
  const elsewhere: DeletedAgent[] = []
  for (const agent of agents) ((agent.connection || missing) === wanted ? here : elsewhere).push(agent)
  return { here, elsewhere }
}

export const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

export type CleanupWords = { one: string; many: string; otherOne: string; otherMany: string }

/** "2 agents and 1 API key". Only names the other kind when there is some. */
export function cleanupCount(here: number, elsewhere: number, words: CleanupWords): string {
  if (elsewhere === 0) return plural(here, words.one, words.many)
  const other = plural(elsewhere, words.otherOne, words.otherMany)
  return here === 0 ? other : `${plural(here, words.one, words.many)} and ${other}`
}

/** What the single-delete dialog says. Names the agent, what stops working, and what stays. */
export function deleteSummary(name: string, kind: "agent" | "key"): string {
  return kind === "key"
    ? `${name} stops working right away: requests with it get 401. It's gone for good and can't be brought back. Tickets and comments it made stay, with its name.`
    : `${name}'s tokens stop working right away. It's gone for good and can't be brought back. Its past comments and tickets stay, with its name.`
}

/** The activity-log line for an agent_deleted event. `apiKey` is AGENT_CONNECTION.API_KEY. */
export function deletedEventText(details: Record<string, string> | undefined, apiKey: string): string {
  const name = details?.name?.trim()
  const what = details?.connection === apiKey ? "API key" : "agent"
  return name ? `Deleted ${what} ${name}` : `Deleted an ${what}`
}
