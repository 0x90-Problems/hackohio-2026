// NutShell — shared names. The display name lives in web/lib/project-templates.json.
// Every part of the app (frontend, backend, MCP server, auth) imports names
// from this file instead of typing them by hand. If a name changes, change it
// here only. Keep this file in sync with docs/schema.md.

// ---------- Token scopes: what an agent is allowed to do ----------
// Same list as 0x90-NextJS-Backend/src/names.ts; keep the two identical.
export const SCOPES = {
  TICKETS_READ: "tickets:read",
  TICKETS_WRITE: "tickets:write",
  COMMENTS_WRITE: "comments:write",
  TICKETS_CLOSE: "tickets:close",
  EVENTS_READ: "events:read",
  CHAT_READ: "chat:read",
  CHAT_WRITE: "chat:write",
  RULES_READ: "rules:read",
  RULES_WRITE: "rules:write",
  RULES_RUN: "rules:run",
  FILES_READ: "files:read",
  FILES_WRITE: "files:write",
  FOLDERS_READ: "folders:read",
  FOLDERS_WRITE: "folders:write",
  FOLDERS_DELETE: "folders:delete",
  FOLDERS_SHARE: "folders:share", // people only: agent tokens are refused even with it
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
  NAME: "name",
  ACTING_FOR: "acting_for", // only when type is "agent"
} as const;

// ---------- Ticket status (default board columns, in order) ----------
// Each project picks its own columns (see "Projects" below). These four are
// the Blank template's columns, and Approve / Request changes look for
// in_review, in_progress and done when a project has them.
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

// ---------- Projects ----------
// A team can have several projects (like GitHub repos). The project key is
// the ticket id prefix: project CLW has tickets CLW-01, CLW-02 ...
export const PROJECT_KEY_PATTERN = "^[A-Z][A-Z0-9]{1,5}$";
// A column ("category") slug: lowercase words joined by _, like in_review
export const CATEGORY_SLUG_PATTERN = "^[a-z0-9]+(_[a-z0-9]+)*$";

// Colors a board column can use (no blue or purple, per the design rules).
export const CATEGORY_COLORS = [
  "gray",
  "red",
  "orange",
  "amber",
  "green",
  "teal",
  "pink",
] as const;
export type CategoryColor = (typeof CATEGORY_COLORS)[number];

// Starting setups for a new project (web/lib/templates.ts has their columns).
export const PROJECT_TEMPLATES = {
  BLANK: "blank",
  TEAM_PLANNING: "team-planning",
  KANBAN: "kanban",
  FEATURE_RELEASE: "feature-release",
  BUG_TRACKER: "bug-tracker",
  ITERATIVE_DEVELOPMENT: "iterative-development",
  PRODUCT_LAUNCH: "product-launch",
  ROADMAP: "roadmap",
  TEAM_RETROSPECTIVE: "team-retrospective",
} as const;
export type ProjectTemplate =
  (typeof PROJECT_TEMPLATES)[keyof typeof PROJECT_TEMPLATES];

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
  TICKET_DELETED: "ticket_deleted",
  TICKET_UPDATED: "ticket_updated",
} as const;
export type EventAction = (typeof EVENT_ACTIONS)[keyof typeof EVENT_ACTIONS];

// ---------- Database names ----------
export const DB_NAME = "hackathon";
export const COLLECTIONS = {
  USERS: "users",
  PROJECTS: "projects",
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
  DELETE_TICKET: "delete_ticket",
  ADD_COMMENT: "add_comment",
  LINK_COMMIT: "link_commit",
  WATCH_CHANGES: "watch_changes",
  READ_COMMENTS: "read_comments",
  LIST_PROJECT_TEMPLATES: "list_project_templates",
  GET_PROJECT_TEMPLATE: "get_project_template",
  CREATE_PROJECT: "create_project",
  GET_PROJECT_TABLE: "get_project_table",
  POST_MESSAGE: "post_message",
  LIST_MESSAGES: "list_messages",
  WAIT_FOR_MENTIONS: "wait_for_mentions",
  ACK_MENTION: "ack_mention",
  LIST_CHANNELS: "list_channels",
  PAUSE_AGENTS: "pause_agents",
  RESUME_AGENTS: "resume_agents",
  LIST_FOLDER: "list_folder",
  CREATE_FOLDER: "create_folder",
  RENAME_FOLDER: "rename_folder",
  MOVE_FOLDER: "move_folder",
  DELETE_FOLDER: "delete_folder",
  RESTORE_FOLDER: "restore_folder",
  READ_NOTE: "read_note",
  CREATE_NOTE: "create_note",
  UPDATE_NOTE: "update_note",
  LIST_VERSIONS: "list_versions",
  GET_FILE_LINK: "get_file_link",
  REQUEST_UPLOAD: "request_upload",
  UPLOAD_STATUS: "upload_status",
} as const;
