// Fills the database with sample data for team 0x90 Problems.
// Matches the Board, Agents and Teams wireframes in docs/design/wireframes.
//
// WARNING: this empties all seven collections first, then inserts fresh data.
// It refuses to run against anything other than a local MongoDB, unless you
// add --allow-remote (for the team's shared Atlas database, after checking
// with the team, since it replaces everyone's data).
//
// Run setup first, then: npm run db:seed
// Shared database:        npm run db:seed -- --allow-remote
import { connect } from "./connect.js";
import {
  ACTOR_FIELDS,
  ACTOR_TYPES,
  AGENT_CONNECTION,
  COLLECTIONS,
  DEFAULT_TOKEN_EXPIRY_HOURS,
  EVENT_ACTIONS,
  PROJECT_TEMPLATES,
  SCOPES,
  STATUS_LABELS,
  TICKET_STATUS,
  TOKEN_PREFIX,
} from "../shared/names.ts";

const { BACKLOG, IN_PROGRESS, IN_REVIEW, DONE } = TICKET_STATUS;

// All times are relative to "now", so valid tokens are always in date
// and the activity feed always looks recent.
const now = Date.now();
const minutesAgo = (m) => new Date(now - m * 60_000);
const hoursAfter = (d, h) => new Date(d.getTime() + h * 3_600_000);

// ---------- users (no passwords: Authelia handles login) ----------

const TEAM = "0x90 Problems";
const users = [
  { _id: "user_dylan", auth_username: "dylan", name: "Dylan", role: "Software integrator / systems" },
  { _id: "user_raddy", auth_username: "raddy", name: "Raddy", role: "UI design / database design" },
  { _id: "user_naz", auth_username: "naz", name: "Naz", role: "A2A / user experience" },
  { _id: "user_debora", auth_username: "debora", name: "Debora", role: "A2A / user experience" },
].map((u) => ({ ...u, team: TEAM, type: ACTOR_TYPES.HUMAN }));

// ---------- agents: one per person ----------

const agents = [
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
    name: "Naz's agent", // placeholder: wireframe says [Agent name]
    owner_id: "user_naz",
    connection: AGENT_CONNECTION.MCP,
    scopes: [SCOPES.TICKETS_READ, SCOPES.COMMENTS_WRITE],
  },
  {
    _id: "agent_debora_always_on",
    name: "Always-on agent", // placeholder: wireframe says [Always-on agent]
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
].map((a) => ({ ...a, revoked: false }));

const agentById = Object.fromEntries(agents.map((a) => [a._id, a]));

// CLW-05 -> CLW
const projectKeyOf = (ticketKey) => ticketKey.split("-")[0];

// ---------- actor helpers ----------

const human = (userId) => ({
  [ACTOR_FIELDS.TYPE]: ACTOR_TYPES.HUMAN,
  [ACTOR_FIELDS.ID]: userId,
});
const agent = (agentId) => ({
  [ACTOR_FIELDS.TYPE]: ACTOR_TYPES.AGENT,
  [ACTOR_FIELDS.ID]: agentId,
  [ACTOR_FIELDS.ACTING_FOR]: agentById[agentId].owner_id,
});

// ---------- agent_tokens: one current token each, plus one expired and one revoked ----------

function token({ agentId, initials, suffix = "", createdMinutesAgo, lastUsedMinutesAgo, scopes, revoked = false }) {
  const created_at = minutesAgo(createdMinutesAgo);
  return {
    agent_id: agentId,
    token_prefix: `${TOKEN_PREFIX}${initials}`,
    token_hash: `fake-hash-${agentById[agentId].owner_id.replace("user_", "")}${suffix}`,
    scopes: scopes ?? agentById[agentId].scopes,
    created_at,
    expires_at: hoursAfter(created_at, DEFAULT_TOKEN_EXPIRY_HOURS),
    last_used_at: lastUsedMinutesAgo == null ? null : minutesAgo(lastUsedMinutesAgo),
    revoked,
  };
}

const agentTokens = [
  // Current, valid tokens ("Last active" times match the Agents wireframe).
  token({ agentId: "agent_raddy_claude", initials: "rd", createdMinutesAgo: 120, lastUsedMinutesAgo: 0 }),
  token({ agentId: "agent_dylan_claude", initials: "dy", createdMinutesAgo: 180, lastUsedMinutesAgo: 18 }),
  token({ agentId: "agent_naz_agent", initials: "na", createdMinutesAgo: 240, lastUsedMinutesAgo: 12 }),
  token({ agentId: "agent_debora_always_on", initials: "de", createdMinutesAgo: 300, lastUsedMinutesAgo: 45 }),

  // TEST: expired. Made 30 h ago with a 24 h expiry, so it ran out 6 h ago.
  token({
    agentId: "agent_raddy_claude",
    initials: "rd",
    suffix: "-expired",
    createdMinutesAgo: 30 * 60,
    lastUsedMinutesAgo: 7 * 60,
    scopes: [SCOPES.TICKETS_WRITE],
  }),

  // TEST: revoked. Still inside its 24 h, but must be rejected.
  token({
    agentId: "agent_dylan_claude",
    initials: "dy",
    suffix: "-revoked",
    createdMinutesAgo: 5 * 60,
    lastUsedMinutesAgo: 4 * 60,
    revoked: true,
  }),
];

// Rule from docs/schema.md: a token's scopes must fit inside its agent's scopes.
for (const t of agentTokens) {
  const allowed = agentById[t.agent_id].scopes;
  const extra = t.scopes.filter((s) => !allowed.includes(s));
  if (extra.length) throw new Error(`Token ${t.token_hash} has scopes its agent lacks: ${extra}`);
}

// ---------- projects: same as the website's sample data ----------

// The Blank template's columns: the four default statuses.
const DEFAULT_COLORS = { backlog: "gray", in_progress: "amber", in_review: "orange", done: "green" };
const defaultCategories = [BACKLOG, IN_PROGRESS, IN_REVIEW, DONE].map((slug, order) => ({
  slug,
  name: STATUS_LABELS[slug],
  color: DEFAULT_COLORS[slug],
  order,
}));

const projects = [
  {
    key: "CLW",
    name: "HackOHI/O build",
    description: "The NutShell app we demo on Sunday.",
    created_by: human("user_dylan"),
    created: 1440,
  },
  {
    key: "PIT",
    name: "Pitch & demo",
    description: "Slides, script and the live agent demo.",
    created_by: human("user_naz"),
    created: 300,
  },
].map(({ created, ...p }) => ({
  ...p,
  team: TEAM,
  template: PROJECT_TEMPLATES.BLANK,
  categories: defaultCategories,
  created_at: minutesAgo(created),
}));

// ---------- tickets CLW-01 to CLW-16, PIT-01 to PIT-03 ----------
// CLW: 5 backlog, 4 in progress, 3 in review, 4 done. PIT: 2 backlog, 1 in progress.

const tickets = [
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
    created_by: agent("agent_raddy_claude"), reviewer_id: "user_dylan", needs_approval: true, created: 180,
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
  // Wireframe shows an agent for Naz here, but Naz's agent only has tickets:read,
  // so it can't create tickets. Created by Naz instead.
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
    created_by: agent("agent_raddy_claude"), reviewer_id: "user_raddy", needs_approval: true, created: 42,
    linked_commits: [
      { sha: "3d1f8a0", message: "Add text index on ticket title and tags", added: 12, removed: 1 },
      { sha: "7e2b9c4", message: "Add combo search box to the board", added: 86, removed: 4 },
    ],
  },

  // Pitch & demo project
  { key: "PIT-01", title: "Outline the 3-minute pitch", tags: ["Pitch"], status: IN_PROGRESS, created_by: human("user_naz"), created: 280 },
  { key: "PIT-02", title: "Record backup demo video", tags: ["Demo"], status: BACKLOG, created_by: human("user_debora"), created: 200 },
  { key: "PIT-03", title: "Seed clean demo tickets", tags: ["Demo", "Data"], status: BACKLOG, created_by: agent("agent_raddy_claude"), created: 60 },
].map(({ created, ...t }) => ({
  needs_approval: false,
  ...t,
  project_key: projectKeyOf(t.key),
  created_at: minutesAgo(created),
}));

// ---------- comments ----------

const comments = [
  { ticket_key: "CLW-05", author: human("user_raddy"), body: "Add an index on ticket status so the board loads fast.", created: 51 },
  { ticket_key: "CLW-05", author: agent("agent_raddy_claude"), body: "Added the status index. Ready for Dylan to approve.", created: 45 },
  { ticket_key: "CLW-06", author: agent("agent_naz_agent"), body: "Checked the tool names against shared/names.ts. They match.", created: 30 },
  { ticket_key: "CLW-10", author: agent("agent_naz_agent"), body: "Draft is in the shared names file. Waiting on Dylan to confirm.", created: 20 },
  { ticket_key: "CLW-12", author: human("user_dylan"), body: "Keep it under 3 minutes and end on the live agent demo.", created: 15 },
  { ticket_key: "CLW-03", author: human("user_dylan"), body: "Looks good. Approved.", created: 505 },
  { ticket_key: "CLW-16", author: agent("agent_raddy_claude"), body: "Search is in. It matches ticket id, title and tags, grouped by column. Ready for Raddy to approve.", created: 5 },
].map(({ created, ...c }) => ({ ...c, created_at: minutesAgo(created) }));

// ---------- events (activity log) ----------
// Every ticket gets a ticket_created event and every comment a comment_added
// event. The moves, commit links and closes are listed by hand below.
// Agents always link a commit before they move a ticket (schema rule).

const ev = (action, ticket_key, actor, minutes, details) => ({
  action,
  ticket_key,
  project_key: projectKeyOf(ticket_key),
  actor,
  ...(details && { details }),
  created_at: minutesAgo(minutes),
});
const moved = (key, actor, minutes, from, to) => ev(EVENT_ACTIONS.TICKET_MOVED, key, actor, minutes, { from, to });
const closed = (key, actor, minutes, from) => ev(EVENT_ACTIONS.TICKET_CLOSED, key, actor, minutes, { from, to: DONE });
const linked = (key, actor, minutes, sha) => ev(EVENT_ACTIONS.COMMIT_LINKED, key, actor, minutes, { sha });

const events = [
  ...tickets.map((t) => ({
    action: EVENT_ACTIONS.TICKET_CREATED,
    ticket_key: t.key,
    project_key: t.project_key,
    actor: t.created_by,
    details: { status: BACKLOG },
    created_at: t.created_at,
  })),
  ...comments.map((c) => ({
    action: EVENT_ACTIONS.COMMENT_ADDED,
    ticket_key: c.ticket_key,
    project_key: projectKeyOf(c.ticket_key),
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

  // Demo ticket: the agent links a commit before each move (schema rule)
  linked("CLW-16", agent("agent_raddy_claude"), 30, "3d1f8a0"),
  moved("CLW-16", agent("agent_raddy_claude"), 29, BACKLOG, IN_PROGRESS),
  linked("CLW-16", agent("agent_raddy_claude"), 8, "7e2b9c4"),
  moved("CLW-16", agent("agent_raddy_claude"), 6, IN_PROGRESS, IN_REVIEW),
];

// ---------- Run ----------

const { client, db, uri } = await connect();
try {
  // Safety check: seeding wipes data, so only allow it on this computer
  // unless --allow-remote was passed on purpose.
  const host = new URL(uri).hostname;
  const allowRemote = process.argv.includes("--allow-remote");
  if (!["localhost", "127.0.0.1"].includes(host) && !allowRemote) {
    throw new Error(
      `Refusing to seed ${host}: seed.js replaces all data. For the shared database, run "npm run db:seed -- --allow-remote".`,
    );
  }

  const data = {
    [COLLECTIONS.USERS]: users,
    [COLLECTIONS.PROJECTS]: projects,
    [COLLECTIONS.AGENTS]: agents,
    [COLLECTIONS.AGENT_TOKENS]: agentTokens,
    [COLLECTIONS.TICKETS]: tickets,
    [COLLECTIONS.COMMENTS]: comments,
    [COLLECTIONS.EVENTS]: events,
  };

  for (const [name, docs] of Object.entries(data)) {
    const collection = db.collection(name);
    await collection.deleteMany({}); // empties it but keeps the rules and indexes
    const { insertedCount } = await collection.insertMany(docs);
    console.log(`${name.padEnd(13)} ${insertedCount} documents`);
  }

  console.log(`\nDone. Sample data is in database "${db.databaseName}".`);
} finally {
  await client.close();
}
