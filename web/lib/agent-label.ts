import type { Agent } from "@/lib/types"

// `agent_<user>_<slug>_<6 hex>` was an id, and `agent_` + 32 hex is an opaque id.
const GENERATED_AGENT_ID = /^agent_(?:[a-z0-9]+(?:_[a-z0-9]+)*_[a-f0-9]{6}|[a-f0-9]{32})$/

function readable(name: string | undefined | null, id?: string): string | undefined {
  const trimmed = name?.trim() ?? ""
  if (!trimmed) return undefined
  if (id && trimmed === id) return undefined
  if (GENERATED_AGENT_ID.test(trimmed)) return undefined
  return trimmed
}

// Prefer a typed display name. A stored name that is only the generated id is not one.
export function visibleAgentName(
  name: string | undefined | null,
  id?: string,
  alternate?: string | null
): string {
  return readable(name, id) ?? readable(alternate, id) ?? "Agent"
}

export function mergeAgentRecords(primary: Agent[], extra: Agent[]): Agent[] {
  const byId = new Map(primary.map((agent) => [agent._id, agent]))
  for (const agent of extra) {
    const existing = byId.get(agent._id)
    if (!existing) {
      byId.set(agent._id, agent)
      continue
    }
    const name = visibleAgentName(existing.name, existing._id, agent.name)
    if (name !== "Agent" && name !== existing.name) {
      byId.set(agent._id, { ...existing, name })
    }
  }
  return [...byId.values()]
}
