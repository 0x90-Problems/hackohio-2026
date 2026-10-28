// Sample data for team 0x90 Problems — the same data as ../db/seed.js.
// Pages read from here until we connect to MongoDB. When we do, swap the
// arrays below for database queries; the field names already match.
import {
  ACTOR_TYPES,
  AGENT_CONNECTION,
  DEFAULT_TOKEN_EXPIRY_HOURS,
  PROJECT_TEMPLATES,
  SCOPES,
  TICKET_STATUS,
  TOKEN_PREFIX,
  type Scope,
} from "@/shared/names"
import type {
  Actor,
  Agent,
  AgentActor,
  AgentToken,
  Comment,
  Event,
  HumanActor,
  Project,
  Ticket,
  User,
} from "@/lib/types"
import { DEFAULT_CATEGORIES } from "@/lib/categories"

const { BACKLOG, IN_PROGRESS, IN_REVIEW, DONE } = TICKET_STATUS

// seed.js uses the real clock. Here "now" is a fixed moment so the server and
// the browser render the same times. Every date below is relative to it.
export const MOCK_NOW = new Date("2026-10-24T18:00:00Z")
const minutesAgo = (m: number) => new Date(MOCK_NOW.getTime() - m * 60_000)
const hoursAfter = (d: Date, h: number) => new Date(d.getTime() + h * 3_600_000)

// Seed id kept for sample tickets. The signed-in person comes from the session.
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
  {
    // The chat assistant at the bottom of the website. It acts for the person
    // using it, and like every agent it can't approve or close tickets.
    _id: "agent_raddy_assistant",
    name: "Nutty",
    owner_id: "user_raddy",
    connection: AGENT_CONNECTION.API_KEY,
    scopes: [SCOPES.TICKETS_READ, SCOPES.TICKETS_WRITE, SCOPES.COMMENTS_WRITE],
  },
].map((a) => ({ ...a, revoked: false }))

// The agent behind the chat assistant (components/assistant)
export const ASSISTANT_AGENT_ID = "agent_raddy_assistant"

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

// ---------- projects ----------

// CLW and PIT stay blank boards. ST is the team-planning table so the grouped
// table is on the page even when MongoDB is not configured.
const boardProjects: Project[] = [
  { key: "CLW", name: "NutShell app", description: "The NutShell app itself.", created_by: human("user_dylan"), created: 1440 },
  { key: "PIT", name: "Pitch & demo", description: "Slides, script and the live agent demo.", created_by: human("user_naz"), created: 300 },
].map(({ created, ...p }) => ({
  ...p,
  team: TEAM,
  template: PROJECT_TEMPLATES.BLANK,
  layout: "board" as const,
  fields: [],
  categories: DEFAULT_CATEGORIES,
  created_at: minutesAgo(created),
}))

export const projects: Project[] = [
  ...boardProjects,
  {
    key: "ST",
    name: "Sprint table",
    description: "Team planning sample, grouped by status.",
    team: TEAM,
    template: PROJECT_TEMPLATES.TEAM_PLANNING,
    layout: "table",
    fields: ["Iteration", "Estimate"],
    categories: [
      { slug: "backlog", name: "Backlog", color: "gray", order: 0 },
      { slug: "ready", name: "Ready", color: "teal", order: 1 },
      { slug: "in_progress", name: "In progress", color: "amber", order: 2 },
      { slug: "in_review", name: "In review", color: "orange", order: 3 },
      { slug: "done", name: "Done", color: "green", order: 4 },
    ],
    created_by: human("user_dylan"),
    created_at: minutesAgo(20),
  },
]

// CLW-05 -> CLW
export const projectKeyOf = (ticketKey: string) => ticketKey.split("-")[0]

// The project /board opens
export const DEFAULT_PROJECT_KEY = "CLW"

// ---------- tickets CLW-01 to CLW-16, PIT-01 to PIT-03 ----------

type TicketInput = Omit<Ticket, "created_at" | "project_key"> & {
  created: number
}

export const tickets: Ticket[] = (
  [
    // Done
    { key: "CLW-01", title: "Repo and project setup", status: DONE, created_by: human("user_dylan"), created: 600 },
    { key: "CLW-02", title: "Requirements locked", status: DONE, created_by: human("user_raddy"), created: 580 },
    {
      key: "CLW-03", title: "Pre-event wireframes", tags: ["Design"], status: DONE,
      created_by: human("user_raddy"), reviewer_id: "user_dylan", created: 720,
      linked_commits: [{ sha: "1ec9d09", message: "pre-event wireframes", added: 3950, removed: 0 }],
    },
    {
      key: "CLW-04", title: "Shared scope and claim names", tags: ["Auth"], status: DONE,
      created_by: agent("agent_raddy_claude"), reviewer_id: "user_dylan", created: 480,
      linked_commits: [{ sha: "c7ecd31", message: "shared scope/claim names", added: 148, removed: 0 }],
    },

    // In review
    {
      key: "CLW-05", title: "MongoDB schema: tickets, agents", tags: ["Database"], status: IN_REVIEW,
      created_by: agent("agent_raddy_claude"), reviewer_id: "user_dylan", created: 180,
      linked_commits: [{ sha: "abc1234", message: "Add tickets collection", added: 20, removed: 2 }],
    },
    {
      key: "CLW-06", title: "MCP tool: create and move ticket", tags: ["MCP"], status: IN_REVIEW,
      created_by: agent("agent_dylan_claude"), reviewer_id: "user_raddy", created: 240,
      linked_commits: [{ sha: "9f3e2a1", message: "Add create_ticket and move_ticket MCP tools", added: 140, removed: 12 }],
    },

    // In progress
    { key: "CLW-07", title: "Agents page: revoke button", tags: ["UI"], status: IN_PROGRESS, created_by: human("user_debora"), created: 300 },
    {
      key: "CLW-08", title: "Redis pub/sub for board events", tags: ["Backend"], status: IN_PROGRESS,
      created_by: agent("agent_dylan_claude"), created: 150,
      linked_commits: [{ sha: "5b7c0d2", message: "Publish board events to Redis", added: 64, removed: 3 }],
    },
    { key: "CLW-09", title: "Ticket card UI", tags: ["UI"], status: IN_PROGRESS, created_by: human("user_raddy"), created: 400 },
    { key: "CLW-10", title: "Define agent JWT scopes", tags: ["Auth"], status: IN_PROGRESS, created_by: human("user_naz"), created: 210 },

    // Backlog
    { key: "CLW-11", title: "Authelia login + 2FA", tags: ["Auth"], status: BACKLOG, created_by: human("user_dylan"), created: 350 },
    { key: "CLW-12", title: "Write 3-minute pitch script", tags: ["Pitch"], status: BACKLOG, created_by: human("user_naz"), created: 330 },
    { key: "CLW-13", title: "Live activity feed", tags: ["UI"], status: BACKLOG, created_by: human("user_debora"), created: 90 },
    { key: "CLW-14", title: "Draft OpenAPI spec for tickets", tags: ["Docs"], status: BACKLOG, created_by: agent("agent_dylan_claude"), created: 70 },
    { key: "CLW-15", title: "Docs site with Zensical", tags: ["Docs"], status: BACKLOG, created_by: human("user_debora"), created: 25 },

    // Demo ticket (see docs/demo-script.md): an agent built it and is waiting for
    // Raddy to approve it. Approving moves it to Done.
    {
      key: "CLW-16", title: "Search tickets by id, title or tag", tags: ["UI", "Search"], status: IN_REVIEW,
      created_by: agent("agent_raddy_claude"), reviewer_id: "user_raddy", created: 42,
      linked_commits: [
        { sha: "3d1f8a0", message: "Add text index on ticket title and tags", added: 12, removed: 1 },
        { sha: "7e2b9c4", message: "Add combo search box to the board", added: 86, removed: 4 },
      ],
    },

    // Team planning table. Empty field values stay blank cells.
    {
      key: "ST-01",
      title: "Plan the capacity review for the next iteration with a long title that should wrap",
      tags: ["High"],
      status: BACKLOG,
      created_by: human("user_dylan"),
      fields: { Iteration: "Sprint 1", Estimate: "3" } as Record<string, string>,
      created: 18,
    },
    { key: "ST-02", title: "Write the iteration goal", status: "ready", created_by: human("user_raddy"), created: 16 },
    {
      key: "ST-03",
      title: "Estimate the remaining stories",
      status: IN_PROGRESS,
      created_by: human("user_naz"),
      fields: { Iteration: "Sprint 1" } as Record<string, string>,
      created: 12,
    },
    {
      key: "ST-04",
      title: "Close last sprint",
      status: DONE,
      created_by: human("user_debora"),
      fields: { Iteration: "Sprint 0", Estimate: "1" } as Record<string, string>,
      created: 40,
    },

    // Pitch & demo project
    { key: "PIT-01", title: "Outline the 3-minute pitch", tags: ["Pitch"], status: IN_PROGRESS, created_by: human("user_naz"), created: 280 },
    { key: "PIT-02", title: "Record backup demo video", tags: ["Demo"], status: BACKLOG, created_by: human("user_debora"), created: 200 },
    { key: "PIT-03", title: "Seed clean demo tickets", tags: ["Demo", "Data"], status: BACKLOG, created_by: agent("agent_raddy_claude"), created: 60 },
  ] satisfies TicketInput[]
).map(({ created, ...t }: TicketInput) => ({
  ...t,
  project_key: projectKeyOf(t.key),
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
  { ticket_key: "CLW-16", author: agent("agent_raddy_claude"), body: "Search is in. It matches ticket id, title and tags, grouped by column. Ready for Raddy to approve.", created: 5 },
].map(({ created, ...c }) => ({ ...c, created_at: minutesAgo(created) }))

// Activity starts empty. Sample tickets stay on the board; a signed-in person
// only sees events they create in this session.
export const events: Event[] = []
