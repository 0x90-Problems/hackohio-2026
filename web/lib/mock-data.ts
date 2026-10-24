// Sample data for team 0x90 Problems — the same data as ../db/seed.js.
// Pages read from here until we connect to MongoDB. When we do, swap the
// arrays below for database queries; the field names already match.
import {
  ACTOR_TYPES,
  AGENT_CONNECTION,
  DEFAULT_TOKEN_EXPIRY_HOURS,
  EVENT_ACTIONS,
  SCOPES,
  TICKET_STATUS,
  TOKEN_PREFIX,
  type Scope,
  type TicketStatus,
} from "@/shared/names"
import type {
  Actor,
  Agent,
  AgentActor,
  AgentToken,
  Comment,
  Event,
  HumanActor,
  Ticket,
  User,
} from "@/lib/types"

const { BACKLOG, IN_PROGRESS, IN_REVIEW, DONE } = TICKET_STATUS

// seed.js uses the real clock. Here "now" is a fixed moment so the server and
// the browser render the same times. Every date below is relative to it.
export const MOCK_NOW = new Date("2026-10-24T18:00:00Z")
const minutesAgo = (m: number) => new Date(MOCK_NOW.getTime() - m * 60_000)
const hoursAfter = (d: Date, h: number) => new Date(d.getTime() + h * 3_600_000)

// The person "logged in" until Authelia is connected.
export const CURRENT_USER_ID = "user_raddy"

// ---------- users ----------

export const TEAM = "0x90 Problems"
export const users: User[] = [
  { _id: "user_dylan", auth_username: "dylan", name: "Dylan", role: "Software integrator / systems" },
  { _id: "user_raddy", auth_username: "raddy", name: "Raddy", role: "UI design / database design" },
  { _id: "user_naz", auth_username: "naz", name: "Naz", role: "A2A / user experience" },
  { _id: "user_debora", auth_username: "debora", name: "Debora", role: "A2A / user experience" },
].map((u) => ({ ...u, team: TEAM, type: ACTOR_TYPES.HUMAN }))

// ---------- agents: one per person ----------

export const agents: Agent[] = [
  {
    _id: "agent_dylan_claude",
    name: "Claude Code",
    owner_id: "user_dylan",
    connection: AGENT_CONNECTION.MCP,
    scopes: [SCOPES.TICKETS_WRITE, SCOPES.COMMENTS_WRITE],
  },
  {
    _id: "agent_raddy_claude",
    name: "Claude Code",
    owner_id: "user_raddy",
    connection: AGENT_CONNECTION.MCP,
    scopes: [SCOPES.TICKETS_WRITE, SCOPES.COMMENTS_WRITE],
  },
  {
    _id: "agent_naz_agent",
    name: "Naz's agent",
    owner_id: "user_naz",
    connection: AGENT_CONNECTION.MCP,
    scopes: [SCOPES.TICKETS_READ, SCOPES.COMMENTS_WRITE],
  },
  {
    _id: "agent_debora_always_on",
    name: "Always-on agent",
    owner_id: "user_debora",
    connection: AGENT_CONNECTION.API_KEY,
    scopes: [SCOPES.TICKETS_READ],
  },
].map((a) => ({ ...a, revoked: false }))

// ---------- lookups ----------

export const getUser = (id: string) => users.find((u) => u._id === id)
export const getAgent = (id: string) => agents.find((a) => a._id === id)
export const currentUser = getUser(CURRENT_USER_ID)!

const human = (userId: string): HumanActor => ({ type: ACTOR_TYPES.HUMAN, id: userId })
const agent = (agentId: string): AgentActor => ({
  type: ACTOR_TYPES.AGENT,
  id: agentId,
  acting_for: getAgent(agentId)!.owner_id,
})

// ---------- agent_tokens: one current token each, plus one expired and one revoked ----------

function token(opts: {
  agentId: string
  initials: string
  suffix?: string
  createdMinutesAgo: number
  lastUsedMinutesAgo: number | null
  scopes?: Scope[]
  revoked?: boolean
}): AgentToken {
  const owner = getAgent(opts.agentId)!
  const created_at = minutesAgo(opts.createdMinutesAgo)
  return {
    agent_id: opts.agentId,
    token_prefix: `${TOKEN_PREFIX}${opts.initials}`,
    token_hash: `fake-hash-${owner.owner_id.replace("user_", "")}${opts.suffix ?? ""}`,
    scopes: opts.scopes ?? owner.scopes,
    created_at,
    expires_at: hoursAfter(created_at, DEFAULT_TOKEN_EXPIRY_HOURS),
    last_used_at: opts.lastUsedMinutesAgo == null ? null : minutesAgo(opts.lastUsedMinutesAgo),
    revoked: opts.revoked ?? false,
  }
}

export const agentTokens: AgentToken[] = [
  token({ agentId: "agent_raddy_claude", initials: "rd", createdMinutesAgo: 120, lastUsedMinutesAgo: 0 }),
  token({ agentId: "agent_dylan_claude", initials: "dy", createdMinutesAgo: 180, lastUsedMinutesAgo: 18 }),
  token({ agentId: "agent_naz_agent", initials: "na", createdMinutesAgo: 240, lastUsedMinutesAgo: 12 }),
  token({ agentId: "agent_debora_always_on", initials: "de", createdMinutesAgo: 300, lastUsedMinutesAgo: 45 }),
  // TEST: expired (made 30 h ago, 24 h expiry)
  token({
    agentId: "agent_raddy_claude",
    initials: "rd",
    suffix: "-expired",
    createdMinutesAgo: 30 * 60,
    lastUsedMinutesAgo: 7 * 60,
    scopes: [SCOPES.TICKETS_WRITE],
  }),
  // TEST: revoked, still inside its 24 h
  token({
    agentId: "agent_dylan_claude",
    initials: "dy",
    suffix: "-revoked",
    createdMinutesAgo: 5 * 60,
    lastUsedMinutesAgo: 4 * 60,
    revoked: true,
  }),
]

// ---------- tickets CLW-01 to CLW-15 ----------

type TicketInput = Omit<Ticket, "needs_approval" | "created_at"> & {
  needs_approval?: boolean
  created: number
}

export const tickets: Ticket[] = (
  [
    // Done
    { key: "CLW-01", title: "Repo and project setup", status: DONE, created_by: human("user_dylan"), created: 600 },
    { key: "CLW-02", title: "Requirements locked", status: DONE, created_by: human("user_raddy"), created: 580 },
    {
      key: "CLW-03", title: "Pre-event wireframes", label: "Design", status: DONE,
      created_by: human("user_raddy"), reviewer_id: "user_dylan", created: 720,
      linked_commits: [{ sha: "1ec9d09", message: "pre-event wireframes", added: 3950, removed: 0 }],
    },
    {
      key: "CLW-04", title: "Shared scope and claim names", label: "Auth", status: DONE,
      created_by: agent("agent_raddy_claude"), reviewer_id: "user_dylan", created: 480,
      linked_commits: [{ sha: "c7ecd31", message: "shared scope/claim names", added: 148, removed: 0 }],
    },

    // In review
    {
      key: "CLW-05", title: "MongoDB schema: tickets, agents", label: "Database", status: IN_REVIEW,
      created_by: agent("agent_raddy_claude"), reviewer_id: "user_dylan", needs_approval: true, created: 180,
      linked_commits: [{ sha: "abc1234", message: "Add tickets collection", added: 20, removed: 2 }],
    },
    {
      key: "CLW-06", title: "MCP tool: create and move ticket", label: "MCP", status: IN_REVIEW,
      created_by: agent("agent_dylan_claude"), reviewer_id: "user_raddy", created: 240,
      linked_commits: [{ sha: "9f3e2a1", message: "Add create_ticket and move_ticket MCP tools", added: 140, removed: 12 }],
    },

    // In progress
    { key: "CLW-07", title: "Agents page: revoke button", label: "UI", status: IN_PROGRESS, created_by: human("user_debora"), created: 300 },
    {
      key: "CLW-08", title: "Redis pub/sub for board events", label: "Backend", status: IN_PROGRESS,
      created_by: agent("agent_dylan_claude"), created: 150,
      linked_commits: [{ sha: "5b7c0d2", message: "Publish board events to Redis", added: 64, removed: 3 }],
    },
    { key: "CLW-09", title: "Ticket card UI", label: "UI", status: IN_PROGRESS, created_by: human("user_raddy"), created: 400 },
    { key: "CLW-10", title: "Define agent JWT scopes", label: "Auth", status: IN_PROGRESS, created_by: human("user_naz"), created: 210 },

    // Backlog
    { key: "CLW-11", title: "Authelia login + 2FA", label: "Auth", status: BACKLOG, created_by: human("user_dylan"), created: 350 },
    { key: "CLW-12", title: "Write 3-minute pitch script", label: "Pitch", status: BACKLOG, created_by: human("user_naz"), created: 330 },
    { key: "CLW-13", title: "Live activity feed", label: "UI", status: BACKLOG, created_by: human("user_debora"), created: 90 },
    { key: "CLW-14", title: "Draft OpenAPI spec for tickets", label: "Docs", status: BACKLOG, created_by: agent("agent_dylan_claude"), created: 70 },
    { key: "CLW-15", title: "Docs site with Zensical", label: "Docs", status: BACKLOG, created_by: human("user_debora"), created: 25 },
  ] satisfies TicketInput[]
).map(({ created, ...t }: TicketInput) => ({
  needs_approval: false,
  ...t,
  created_at: minutesAgo(created),
}))

// ---------- comments ----------

export const comments: Comment[] = [
  { ticket_key: "CLW-05", author: human("user_raddy"), body: "Add an index on ticket status so the board loads fast.", created: 51 },
  { ticket_key: "CLW-05", author: agent("agent_raddy_claude"), body: "Added the status index. Ready for Dylan to approve.", created: 45 },
  { ticket_key: "CLW-06", author: agent("agent_naz_agent"), body: "Checked the tool names against shared/names.ts. They match.", created: 30 },
  { ticket_key: "CLW-10", author: agent("agent_naz_agent"), body: "Draft is in the shared names file. Waiting on Dylan to confirm.", created: 20 },
  { ticket_key: "CLW-12", author: human("user_dylan"), body: "Keep it under 3 minutes and end on the live agent demo.", created: 15 },
  { ticket_key: "CLW-03", author: human("user_dylan"), body: "Looks good. Approved.", created: 505 },
].map(({ created, ...c }) => ({ ...c, created_at: minutesAgo(created) }))

// ---------- events (activity log) ----------

const ev = (
  action: Event["action"],
  ticket_key: string,
  actor: Actor,
  minutes: number,
  details?: Event["details"]
): Event => ({ action, ticket_key, actor, ...(details && { details }), created_at: minutesAgo(minutes) })
const moved = (key: string, actor: Actor, minutes: number, from: TicketStatus, to: TicketStatus) =>
  ev(EVENT_ACTIONS.TICKET_MOVED, key, actor, minutes, { from, to })
const closed = (key: string, actor: Actor, minutes: number, from: TicketStatus) =>
  ev(EVENT_ACTIONS.TICKET_CLOSED, key, actor, minutes, { from, to: DONE })
const linked = (key: string, actor: Actor, minutes: number, sha: string) =>
  ev(EVENT_ACTIONS.COMMIT_LINKED, key, actor, minutes, { sha })

export const events: Event[] = [
  ...tickets.map((t) => ({
    action: EVENT_ACTIONS.TICKET_CREATED,
    ticket_key: t.key,
    actor: t.created_by,
    details: { status: BACKLOG },
    created_at: t.created_at,
  })),
  ...comments.map((c) => ({
    action: EVENT_ACTIONS.COMMENT_ADDED,
    ticket_key: c.ticket_key,
    actor: c.author,
    created_at: c.created_at,
  })),

  moved("CLW-01", human("user_dylan"), 590, BACKLOG, IN_PROGRESS),
  closed("CLW-01", human("user_dylan"), 560, IN_PROGRESS),

  moved("CLW-02", human("user_raddy"), 570, BACKLOG, IN_PROGRESS),
  closed("CLW-02", human("user_dylan"), 540, IN_PROGRESS),

  moved("CLW-03", human("user_raddy"), 700, BACKLOG, IN_PROGRESS),
  linked("CLW-03", human("user_raddy"), 525, "1ec9d09"),
  moved("CLW-03", human("user_raddy"), 520, IN_PROGRESS, IN_REVIEW),
  closed("CLW-03", human("user_dylan"), 500, IN_REVIEW),

  linked("CLW-04", agent("agent_raddy_claude"), 470, "c7ecd31"),
  moved("CLW-04", agent("agent_raddy_claude"), 468, BACKLOG, IN_REVIEW),
  closed("CLW-04", human("user_dylan"), 440, IN_REVIEW),

  moved("CLW-05", human("user_raddy"), 170, BACKLOG, IN_PROGRESS),
  linked("CLW-05", agent("agent_raddy_claude"), 65, "abc1234"),
  moved("CLW-05", agent("agent_raddy_claude"), 60, IN_PROGRESS, IN_REVIEW),

  moved("CLW-06", human("user_dylan"), 230, BACKLOG, IN_PROGRESS),
  linked("CLW-06", agent("agent_dylan_claude"), 100, "9f3e2a1"),
  moved("CLW-06", agent("agent_dylan_claude"), 95, IN_PROGRESS, IN_REVIEW),

  moved("CLW-07", human("user_debora"), 200, BACKLOG, IN_PROGRESS),

  linked("CLW-08", agent("agent_dylan_claude"), 40, "5b7c0d2"),
  moved("CLW-08", agent("agent_dylan_claude"), 38, BACKLOG, IN_PROGRESS),

  moved("CLW-09", human("user_raddy"), 300, BACKLOG, IN_PROGRESS),
  moved("CLW-10", human("user_naz"), 120, BACKLOG, IN_PROGRESS),
]
