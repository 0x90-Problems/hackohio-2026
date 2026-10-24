// Shapes of the documents in each collection. Field names match docs/schema.md
// exactly, so the same types work for mock data now and MongoDB later.
import type {
  ACTOR_TYPES,
  AgentConnection,
  EventAction,
  Scope,
  TicketStatus,
} from "@/shared/names"

export type HumanActor = { type: typeof ACTOR_TYPES.HUMAN; id: string }
export type AgentActor = {
  type: typeof ACTOR_TYPES.AGENT
  id: string
  acting_for: string
}
export type Actor = HumanActor | AgentActor

export type User = {
  _id: string
  auth_username: string
  name: string
  role?: string
  team: string
  type: typeof ACTOR_TYPES.HUMAN
}

export type Agent = {
  _id: string
  name: string
  owner_id: string
  connection: AgentConnection
  scopes: Scope[]
  revoked: boolean
}

export type AgentToken = {
  agent_id: string
  token_prefix: string
  token_hash: string
  scopes: Scope[]
  created_at: Date
  expires_at: Date
  last_used_at: Date | null
  revoked: boolean
}

export type LinkedCommit = {
  sha: string
  message: string
  added: number
  removed: number
}

export type Ticket = {
  key: string
  title: string
  label?: string
  status: TicketStatus
  created_by: Actor
  reviewer_id?: string
  needs_approval: boolean
  linked_commits?: LinkedCommit[]
  created_at: Date
}

export type Comment = {
  ticket_key: string
  author: Actor
  body: string
  created_at: Date
}

export type Event = {
  action: EventAction
  ticket_key: string
  actor: Actor
  details?: Record<string, string>
  created_at: Date
}
