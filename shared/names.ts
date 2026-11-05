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
  CHAT_MANAGE: "chat:manage", // people only: create and manage chat channels
  CHAT_DM: "chat:dm", // people only: start direct messages
  RULES_READ: "rules:read",
  RULES_WRITE: "rules:write",
  RULES_RUN: "rules:run",
  FILES_READ: "files:read",
  FILES_WRITE: "files:write",
  FOLDERS_READ: "folders:read",
  FOLDERS_WRITE: "folders:write",
  FOLDERS_DELETE: "folders:delete",
  FOLDERS_SHARE: "folders:share", // people only: agent tokens are refused even with it
  WHITEBOARD_READ: "whiteboard:read",
  WHITEBOARD_WRITE: "whiteboard:write",
  WHITEBOARD_VIEW: "whiteboard:view", // pictures of a board (wb_view_region); off unless the owner ticks it
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
  // An org admin removed someone from the organization. ticket_key is "": it isn't about a ticket.
  PERSON_REMOVED: "person_removed",
  // An agent or API key was deleted for good. ticket_key is "", like person_removed.
  AGENT_DELETED: "agent_deleted",
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

// ---------- Someone on no team ----------
// New signups join no team until an admin adds them. Folders and Chat answer
// 403 with CODE for them; the pages show TITLE and HINT instead of an error.
export const NO_TEAM = {
  CODE: "no_team",
  TITLE: "You're not on a team yet.",
  HINT: "Ask an admin to invite you.",
} as const;

// ---------- Agent tokens ----------
export const TOKEN_PREFIX = "clw_";        // shown as clw_rd••••••
export const DEFAULT_TOKEN_EXPIRY_HOURS = 24;

// ---------- MCP tools (names shown on the Agents page) ----------
// Same names as TOOLS in 0x90-NextJS-Backend src/mcp-http.ts. Descriptions live in
// shared/mcp-tools.json (web/scripts/sync-mcp-tools.mjs copies them from there).
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
  CHAT_LIST_CHANNELS: "chat_list_channels",
  CHAT_READ: "chat_read",
  CHAT_THREAD: "chat_thread",
  CHAT_SEARCH: "chat_search",
  CHAT_POST: "chat_post",
  CHAT_JOIN: "chat_join",
  CHAT_LEAVE: "chat_leave",
  CHAT_EDIT: "chat_edit",
  CHAT_DELETE: "chat_delete",
  CHAT_MARK_READ: "chat_mark_read",
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
  FILE_DIFF: "file_diff",
  SEARCH_FILES: "search_files",
  LIST_FILE_LINKS: "list_file_links",
  LIST_TICKET_FILES: "list_ticket_files",
  LINK_FILE_TO_TICKET: "link_file_to_ticket",
  UNLINK_FILE_FROM_TICKET: "unlink_file_from_ticket",
  WB_LIST_BOARDS: "wb_list_boards",
  WB_CREATE_BOARD: "wb_create_board",
  WB_READ_BOARD: "wb_read_board",
  WB_APPLY_OPS: "wb_apply_ops",
  WB_SAVE_BOARD: "wb_save_board",
  WB_VIEW_REGION: "wb_view_region",
} as const;
export type McpTool = (typeof MCP_TOOLS)[keyof typeof MCP_TOOLS];

// ---------- Multiple organizations (behind NEXT_PUBLIC_MULTI_ORG) ----------
// Codes and headers match the board API's org contract; TEXT is what the web app shows.
export const ORG_HEADERS = {
  TEAM: "x-nutshell-team", // the active team (and so its org)
  ORG: "x-nutshell-org",   // the active org, when no team is picked
} as const;

export const ORG_ROLES = {
  ADMIN: "admin",
  MEMBER: "member",
} as const;
export type OrgMemberRole = (typeof ORG_ROLES)[keyof typeof ORG_ROLES];

export const INVITE_STATUS = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  REVOKED: "revoked",
  EXPIRED: "expired",
} as const;
export type InviteStatus = (typeof INVITE_STATUS)[keyof typeof INVITE_STATUS];

export const ORG_ERRORS = {
  LAST_ADMIN: "last_admin",
  RATE_LIMITED: "rate_limited",
  INVITE_INVALID: "invite_invalid",
  EMAIL_MISMATCH: "email_mismatch",
  CODE_INVALID: "code_invalid",
  NOT_A_MEMBER: "not_a_member",
  NOT_CONFIGURED: "not_configured",
} as const;

export const ORG_DEFAULT_TEAM = "General";
export const INVITE_TOKEN_PREFIX = "nsi_";
export const INVITE_EXPIRY_DAYS = { MIN: 1, MAX: 14, DEFAULT: 7 } as const;

export const ORG_TEXT = {
  SWITCHER_LABEL: "Organization and team",
  ORGS_HEADING: "Organizations",
  TEAMS_HEADING: "Teams",
  CREATE: "Create organization",
  CREATE_TITLE: "Create an organization",
  CREATE_HINT: "You'll be its admin. It starts with a General team, and you go straight to its board.",
  NAME_LABEL: "Organization name",
  NAME_HINT: "1 to 60 characters.",
  CREATING: "Creating…",
  CREATE_FAILED: "Couldn't create the organization",
  RATE_LIMITED: "You've created as many organizations as you can today. Try again tomorrow.",
  ROLE_LABELS: { admin: "Admin", member: "Member" },
  // Organization page
  SETTINGS_TITLE: "Organization",
  SAVE: "Save",
  SAVED: "Organization saved",
  MEMBERS_TITLE: "Members",
  MEMBERS_HINT: "People in this organization. Emails are never shown here.",
  REMOVE: "Remove",
  REMOVE_CONFIRM: "Remove from the organization?",
  REMOVE_HINT: "They lose access to this organization's teams, boards, folders and chat. Their name stays on what they did.",
  INVITES_TITLE: "Invites",
  INVITES_HINT: "Invite someone by email. We never say whether an address already has an account.",
  INVITE_EMAIL_LABEL: "Email address",
  INVITE_ROLE_LABEL: "Role",
  INVITE_EXPIRY_LABEL: "Expires after",
  SEND_INVITE: "Send invite",
  SENDING: "Sending…",
  INVITE_SENT: "Invite sent",
  INVITE_SENT_HINT: "If that address can get mail, an invite is on its way.",
  INVITE_LIMIT: "That's as many invites as this organization can send today. Try again tomorrow.",
  LINK_TITLE: "Invite link",
  LINK_HINT: "Send this link to them yourself. It works once, and only for 24 hours. It isn't shown again.",
  COPY_LINK: "Copy link",
  LINK_COPIED: "Link copied",
  RESEND: "Resend",
  RESENT: "Invite sent again. The old link no longer works.",
  REVOKE: "Revoke",
  REVOKED: "Invite revoked",
  NO_INVITES: "No invites yet.",
  NOT_JOINED: "Not joined yet",
  INVITE_STATES: { pending: "Invited · pending", accepted: "Joined", revoked: "Revoked", expired: "Expired" },
  ADMIN_ONLY: "Only an organization admin or a team manager can invite people.",
  MANAGER_INVITE_HINT: "As a team manager you can invite members. An admin sends them the link (with Resend) and can see every invite.",
  NOT_CONFIGURED: "Invites aren't set up on this site yet. Ask an admin.",
  EMAIL_NOT_CONFIGURED: "Email checks aren't set up yet. Ask the person who invited you for a new link.",
  CHANGED_ELSEWHERE: "That invite changed in the meantime. The list is up to date now.",
  // Accept page
  ACCEPT_TITLE: "You're invited",
  ACCEPT_SIGN_IN: "Sign in or create an account to see this invite.",
  SIGN_IN: "Sign in",
  SIGN_UP: "Create an account",
  INVITE_INVALID: "This invite link isn't valid. It may have expired or been used already. Ask for a new one.",
  INVITE_MISSING: "Open the link from your invite to join an organization.",
  JOIN: "Join",
  JOINING: "Joining…",
  JOINED: "You're in",
  PICK_TEAM: "Pick a team to start in",
  GO_TO_BOARD: "Go to the board",
  // Email check (email mode only)
  VERIFY_TITLE: "Check your email address",
  VERIFY_HINT: "This invite is for a verified email address. Enter yours and we'll send a 6-digit code.",
  VERIFY_SEND: "Send code",
  VERIFY_SENT: "If that address works, a code is on its way.",
  VERIFY_CODE_LABEL: "6-digit code",
  VERIFY_CHECK: "Verify",
  VERIFY_WRONG: "That code didn't work. Check it and try again.",
  VERIFIED: "Email verified",
  // Onboarding (signed in, in no organization)
  ONBOARD_TITLE: "You're not in an organization yet",
  ONBOARD_HINT: "Create one to get started, or wait for an admin to invite you.",
  ONBOARD_WAIT_TITLE: "Wait for an invite",
  ONBOARD_WAIT_HINT: "When an admin invites you, open the link in the invite to join.",
  ONBOARD_INVITES: "Invites waiting for you",
  ONBOARD_INVITE_OPEN: "Open the link in your invite email to join.",
  ONBOARD_NO_INVITES: "No invites for your verified email yet.",
  // Leaving, on the profile page
  LEAVE_TITLE: "Leave organization",
  LEAVE_HINT: "You lose access to its teams, boards, folders and chat. An admin can invite you back.",
  LEAVE: "Leave",
  LEAVE_CONFIRM: "Leave this organization?",
  LEFT: "You left the organization",
  LAST_ADMIN: "You're this organization's only admin, so you can't leave it. Invite another admin first.",
  LAST_ADMIN_REMOVE: "That's the organization's only admin, so they can't be removed.",
  CANCEL: "Cancel",
  CURRENT: "Current",
  EXPIRES: "Expires",
  NAME_COLUMN: "Name",
  TOKEN_EXPIRY_LABEL: "Agent token expiry",
  TOKEN_EXPIRY_OPTIONS: [
    { hours: 1, label: "1 hour" },
    { hours: 8, label: "8 hours" },
    { hours: 24, label: "24 hours" },
    { hours: 72, label: "3 days" },
    { hours: 168, label: "7 days" },
  ],
  INVITE_EXPIRY_OPTIONS: [
    { days: 1, label: "1 day" },
    { days: 3, label: "3 days" },
    { days: 7, label: "7 days" },
    { days: 14, label: "14 days" },
  ],
  COPY_FAILED: "Couldn't copy. Select the link and copy it yourself.",
  LOAD_FAILED: "Couldn't load your organizations",
  SAVE_FAILED: "Couldn't save the organization",
  ACTION_FAILED: "That didn't work. Try again.",
} as const;
