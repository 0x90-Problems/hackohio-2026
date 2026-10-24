// buck2agents — shared names
// Every part of the app (frontend, backend, MCP server, auth) imports names
// from this file instead of typing them by hand. If a name changes, change it
// here only. Keep this file in sync with docs/schema.md.

// ---------- Token scopes: what an agent is allowed to do ----------
export const SCOPES = {
  TICKETS_READ: "tickets:read",
  TICKETS_WRITE: "tickets:write",
  COMMENTS_WRITE: "comments:write",
  TICKETS_CLOSE: "tickets:close",
} as const;
export type Scope = (typeof SCOPES)[keyof typeof SCOPES];
export const ALL_SCOPES: Scope[] = Object.values(SCOPES);

// ---------- Token claims: the labeled facts inside an agent's token ----------
export const CLAIMS = {
  ACTOR_TYPE: "actor_type",     // "human" or "agent"
  ON_BEHALF_OF: "on_behalf_of", // the user an agent acts for
  SCOPES: "scopes",             // list of scopes from above
} as const;

// ---------- Who did something ----------
export const ACTOR_TYPES = {
  HUMAN: "human",
  AGENT: "agent",
} as const;
export type ActorType = (typeof ACTOR_TYPES)[keyof typeof ACTOR_TYPES];

// The actor object stored on tickets (created_by), comments (author)
// and events (actor).
export const ACTOR_FIELDS = {
  TYPE: "type",
  ID: "id",
  ACTING_FOR: "acting_for", // only when type is "agent"
} as const;

// ---------- Ticket status (board columns, in order) ----------
export const TICKET_STATUS = {
  BACKLOG: "backlog",
  IN_PROGRESS: "in_progress",
  IN_REVIEW: "in_review",
  DONE: "done",
} as const;
export type TicketStatus = (typeof TICKET_STATUS)[keyof typeof TICKET_STATUS];
export const BOARD_COLUMNS: TicketStatus[] = [
  TICKET_STATUS.BACKLOG,
  TICKET_STATUS.IN_PROGRESS,
  TICKET_STATUS.IN_REVIEW,
  TICKET_STATUS.DONE,
];

// Text shown on screen for each status.
export const STATUS_LABELS: Record<TicketStatus, string> = {
  backlog: "Backlog",
  in_progress: "In progress",
  in_review: "In review",
  done: "Done",
};

// ---------- How an agent connects ----------
export const AGENT_CONNECTION = {
  MCP: "mcp",
  API_KEY: "api_key",
} as const;
export type AgentConnection =
  (typeof AGENT_CONNECTION)[keyof typeof AGENT_CONNECTION];

// ---------- Activity log actions (events collection) ----------
export const EVENT_ACTIONS = {
  TICKET_CREATED: "ticket_created",
  TICKET_MOVED: "ticket_moved",
  COMMENT_ADDED: "comment_added",
  COMMIT_LINKED: "commit_linked",
  TICKET_CLOSED: "ticket_closed",
} as const;
export type EventAction = (typeof EVENT_ACTIONS)[keyof typeof EVENT_ACTIONS];

// ---------- Database names ----------
export const DB_NAME = "hackathon";
export const COLLECTIONS = {
  USERS: "users",
  AGENTS: "agents",
  AGENT_TOKENS: "agent_tokens",
  TICKETS: "tickets",
  COMMENTS: "comments",
  EVENTS: "events",
} as const;

// ---------- Agent tokens ----------
export const TOKEN_PREFIX = "clw_";        // shown as clw_rd••••••
export const DEFAULT_TOKEN_EXPIRY_HOURS = 24;

// ---------- MCP tools (names shown on the API page) ----------
export const MCP_TOOLS = {
  GET_BOARD: "get_board",
  CREATE_TICKET: "create_ticket",
  MOVE_TICKET: "move_ticket",
  ADD_COMMENT: "add_comment",
  LINK_COMMIT: "link_commit",
  WATCH_CHANGES: "watch_changes",
} as const;
