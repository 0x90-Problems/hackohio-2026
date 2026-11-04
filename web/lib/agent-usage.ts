// Usage the board API derives from an agent's tokens (GET /agents): when it was
// last used and whether its access has expired. Pure so it can be unit tested.

export type AgentUsage = {
  last_used_at: Date | null
  expired: boolean
}

export type AgentAccess = "revoked" | "expired" | "active"

const NEVER: AgentUsage = { last_used_at: null, expired: false }

/** Reads last_used_at / expired from one GET /agents row. Missing or bad values mean never used, not expired. */
export function readAgentUsage(row: unknown): AgentUsage {
  if (row === null || typeof row !== "object") return NEVER
  const { last_used_at, expired } = row as { last_used_at?: unknown; expired?: unknown }
  const used = typeof last_used_at === "string" ? new Date(last_used_at) : null
  return {
    last_used_at: used && !Number.isNaN(used.getTime()) ? used : null,
    expired: expired === true,
  }
}

/** Revoked wins over expired; an expired agent can no longer act, like a revoked one. */
export function agentAccess(agent: { revoked: boolean }, usage?: AgentUsage): AgentAccess {
  if (agent.revoked) return "revoked"
  return usage?.expired ? "expired" : "active"
}

/**
 * Overlays live usage onto saved API keys. Saved keys carry no agent id, so they
 * match the live agent by owner and name (an owner can't reuse a live agent name).
 */
export function withKeyUsage<K extends { name: string; owner_id: string; last_used_at: Date | null }>(
  keys: K[],
  agents: ({ name: string; owner_id: string; revoked: boolean } & AgentUsage)[],
): (K & { expired: boolean })[] {
  return keys.map((key) => {
    const matches = agents.filter((agent) => agent.name === key.name && agent.owner_id === key.owner_id)
    const agent = matches.find((item) => !item.revoked) ?? matches[0]
    if (!agent) return { ...key, expired: false }
    return { ...key, last_used_at: agent.last_used_at ?? key.last_used_at, expired: agentAccess(agent, agent) === "expired" }
  })
}
