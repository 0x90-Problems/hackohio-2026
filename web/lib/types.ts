// Shapes of the documents in each collection. Field names match docs/schema.md
// exactly, so the same types work for mock data now and MongoDB later.
import type {
  ACTOR_TYPES,
  CategoryColor,
  ProjectTemplate,
  AgentConnection,
  ApprovalMode,
  EventAction,
  Scope,
} from "@/shared/names"

export type HumanActor = { type: typeof ACTOR_TYPES.HUMAN; id: string; name?: string }
export type AgentActor = {
  type: typeof ACTOR_TYPES.AGENT
  id: string
  name?: string
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
  // Repository name in the 0x90-Problems GitHub org, when the agent sent one.
  repo?: string
}

// A project is one board, like a GitHub repo. A team can have several.
// Its `key` is the ticket id prefix: project CLW has tickets CLW-01, CLW-02 ...
export type ProjectLayout = "board" | "table" | "roadmap"

export type Project = {
  key: string
  name: string
  description?: string
  team: string
  // The board has no team for it, so `team` above is only where it's listed
  unassigned?: boolean
  template?: ProjectTemplate
  layout?: ProjectLayout
  // Extra columns on a table layout, such as Iteration or Estimate
  fields?: string[]
  // The board's columns, in order
  categories: Category[]
  // Tags the template suggests before any ticket uses them
  starter_tags?: string[]
  created_by: Actor
  created_at: Date
  archived?: boolean
  // Who needs a person's approval to close a ticket. The board always fills it in.
  approval?: ApprovalMode
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
  linked_commits?: LinkedCommit[]
  owner_id?: string
  // YYYY-MM-DD. Where the ticket starts on a roadmap timeline; due_date is where it ends.
  start_date?: string
  due_date?: string
  description?: string
  card_color?: CategoryColor
  // Values for the project's table fields. Missing keys render as empty cells.
  fields?: Record<string, string>
  // Set while a move to done waits for a person to approve it; the ticket stays in its column.
  approval_request?: ApprovalRequest
  // Who approved the last close, and when. Cleared when the ticket leaves done.
  approved_by?: Actor
  approved_at?: Date
  created_at: Date
}

/** A Folders file on a comment, pinned to a version (the same shape chat messages use). */
export type CommentAttachment = { file_id: string; version: number }

export type ApprovalRequest = {
  by: Actor
  at: Date
  // The column it was in when asked, and the one asked for
  from: string
  to: string
}

export type Comment = {
  ticket_key: string
  author: Actor
  body: string
  /** Only on comments with files. Names and access come from Folders, per viewer. */
  attachments?: CommentAttachment[]
  created_at: Date
}

export type Event = {
  action: EventAction
  ticket_key: string
  project_key: string
  actor: Actor
  details?: Record<string, string>
  created_at: Date
  // Client only: a local echo shown right away, replaced when the server's copy arrives.
  local?: true
}
