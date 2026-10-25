// Shapes of the documents in each collection. Field names match docs/schema.md
// exactly, so the same types work for mock data now and MongoDB later.
import type {
  ACTOR_TYPES,
  CategoryColor,
  ProjectTemplate,
  AgentConnection,
  EventAction,
  Scope,
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

// A project is one board, like a GitHub repo. A team can have several.
// Its `key` is the ticket id prefix: project CLW has tickets CLW-01, CLW-02 ...
export type Project = {
  key: string
  name: string
  description?: string
  team: string
  template?: ProjectTemplate
  // The board's columns, in order
  categories: Category[]
  // Tags the template suggests before any ticket uses them
  starter_tags?: string[]
  created_by: Actor
  created_at: Date
}

// A board column. Tickets point at one through `status` (the category slug).
// The four TICKET_STATUS words are the starting categories; people can add more.
export type Category = {
  slug: string
  name: string
  color: CategoryColor
  order: number
}

export type Ticket = {
  key: string
  project_key: string
  title: string
  tags?: string[]
  status: string
  created_by: Actor
  reviewer_id?: string
  needs_approval: boolean
  linked_commits?: LinkedCommit[]
  owner_id?: string
  due_date?: string
  description?: string
  card_color?: CategoryColor
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
  project_key: string
  actor: Actor
  details?: Record<string, string>
  created_at: Date
}
