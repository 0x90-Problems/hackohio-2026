// Adds the CLW demo project (HackOHI/O build, with demo ticket CLW-16) to the
// database without touching anything else. See docs/demo-script.md.
//
//   npm run demo:restore -- --as raddyratt            add CLW if it isn't there
//   npm run demo:restore -- --as raddyratt --reset    put CLW back as new, e.g.
//                                                     after a rehearsal approved CLW-16
//
// --as is the username of the person presenting. They become the reviewer who
// approves CLW-16, and its agent ("Claude Code") acts for them, so "Waiting on
// you" shows CLW-16 when they sign in. Only documents of project CLW (and that
// person's demo agent) are ever written or removed.
import { connect } from "./connect.js";
import { COLLECTIONS } from "../shared/names.ts";
import { agents, comments, events, projects, tickets, users } from "./sample-data.js";

const KEY = "CLW";
const DEMO_USER = "user_raddy";
const DEMO_AGENT = "agent_raddy_claude";

const args = process.argv.slice(2);
const reset = args.includes("--reset");
const asIndex = args.indexOf("--as");
const username = asIndex >= 0 ? args[asIndex + 1] : undefined;
if (!username) {
  console.error("Say who presents: npm run demo:restore -- --as <username>");
  process.exit(1);
}

const isClw = (doc) => doc.project_key === KEY || doc.key === KEY;
const clwFilter = { project_key: KEY };

const { client, db } = await connect();
try {
  const presenter = await db.collection(COLLECTIONS.USERS).findOne({ auth_username: username });
  if (!presenter) {
    throw new Error(`No user "${username}" in the database. Sign in on the site once, then try again.`);
  }
  const agentId = `agent_${username.replace(/[^a-z0-9]/gi, "").toLowerCase()}_claude`;

  // The demo was written for "Raddy" and his Claude Code agent: hand both to the presenter
  const swap = (value) => {
    if (Array.isArray(value)) return value.map(swap);
    if (value instanceof Date || value === null || typeof value !== "object") {
      if (value === DEMO_USER) return presenter._id;
      if (value === DEMO_AGENT) return agentId;
      return value;
    }
    const swapped = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, swap(v)]));
    // Actors carry their name, so the board shows it even before the live
    // directory knows the demo agent
    if ((swapped.type === "human" || swapped.type === "agent") && typeof swapped.id === "string") {
      const name = names.get(swapped.id);
      if (name) swapped.name = name;
    }
    return swapped;
  };
  const names = new Map([
    ...users.map((u) => [u._id, u.name]),
    ...agents.map((a) => [a._id, a.name]),
    [presenter._id, presenter.name],
    [agentId, "Claude Code"],
  ]);

  // The agent's comment named the old demo reviewer
  const clwComments = comments.map((c) =>
    c.ticket_key === `${KEY}-16`
      ? { ...c, body: c.body.replace("Ready for Raddy to approve.", "Ready for your approval.") }
      : c
  );

  const data = {
    [COLLECTIONS.PROJECTS]: projects.filter(isClw).map(swap),
    [COLLECTIONS.TICKETS]: tickets.filter(isClw).map(swap),
    // Comments and events need text ids, in the same form the app writes
    // (web/lib/board-docs.ts); projects and tickets use MongoDB's own
    [COLLECTIONS.COMMENTS]: clwComments
      .filter((c) => c.ticket_key.startsWith(`${KEY}-`))
      .map((c) => ({ _id: `${c.ticket_key}:${c.created_at.toISOString()}`, ...swap(c) })),
    [COLLECTIONS.EVENTS]: events
      .filter(isClw)
      .map((e) => ({ _id: `${e.action}:${e.ticket_key}:${e.created_at.toISOString()}`, ...swap(e) })),
  };

  const existing = await db.collection(COLLECTIONS.PROJECTS).countDocuments({ key: KEY });
  const existingTickets = await db.collection(COLLECTIONS.TICKETS).countDocuments(clwFilter);
  if ((existing || existingTickets) && !reset) {
    console.log(`Project ${KEY} is already there. To put it back as new, add --reset.`);
    process.exit(0);
  }

  if (reset) {
    const removed = await Promise.all([
      db.collection(COLLECTIONS.PROJECTS).deleteMany({ key: KEY }),
      db.collection(COLLECTIONS.TICKETS).deleteMany(clwFilter),
      db.collection(COLLECTIONS.COMMENTS).deleteMany({ ticket_key: { $regex: `^${KEY}-` } }),
      db.collection(COLLECTIONS.EVENTS).deleteMany(clwFilter),
    ]);
    console.log(`Removed the old ${KEY} documents: ${removed.map((r) => r.deletedCount).join(", ")}`);
  }

  // The presenter's demo agent, if they don't have it yet
  const template = agents.find((a) => a._id === DEMO_AGENT);
  const agentResult = await db.collection(COLLECTIONS.AGENTS).updateOne(
    { _id: agentId },
    { $setOnInsert: { ...template, _id: agentId, owner_id: presenter._id } },
    { upsert: true }
  );
  if (agentResult.upsertedCount) console.log(`Added agent ${agentId} (Claude Code for ${presenter.name})`);

  for (const [name, docs] of Object.entries(data)) {
    const { insertedCount } = await db.collection(name).insertMany(docs);
    console.log(`${name.padEnd(9)} +${insertedCount}`);
  }
  console.log(`\nDone. ${KEY}-16 is waiting for ${presenter.name} (${username}) to approve it.`);
} finally {
  await client.close();
}
