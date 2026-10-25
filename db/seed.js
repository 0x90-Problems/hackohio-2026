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
import { COLLECTIONS } from "../shared/names.ts";
import {
  agentTokens,
  agents,
  comments,
  events,
  projects,
  tickets,
  users,
} from "./sample-data.js";

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
