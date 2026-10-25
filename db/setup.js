// Creates the seven collections, their validation rules and their indexes,
// exactly as described in docs/schema.md.
//
// Safe to run more than once: existing collections get their rules updated,
// existing indexes are left alone, and no data is deleted.
//
// Run with: npm run db:setup
import { connect } from "./connect.js";
import { COLLECTIONS } from "../shared/names.ts";
import { validators } from "../web/lib/board-validators.js";

// ---------- Indexes (the "Indexes" table in docs/schema.md) ----------

const indexes = [
  [COLLECTIONS.USERS, { auth_username: 1 }, { unique: true }],
  [COLLECTIONS.PROJECTS, { key: 1 }, { unique: true }],
  [COLLECTIONS.PROJECTS, { team: 1 }, {}],
  [COLLECTIONS.TICKETS, { project_key: 1, status: 1 }, {}],
  [COLLECTIONS.TICKETS, { key: 1 }, { unique: true }],
  [COLLECTIONS.TICKETS, { title: "text", tags: "text" }, { name: "ticket_search" }],
  [COLLECTIONS.COMMENTS, { ticket_key: 1 }, {}],
  [COLLECTIONS.EVENTS, { project_key: 1, created_at: -1 }, {}], // -1 = newest first
  [COLLECTIONS.EVENTS, { created_at: -1 }, {}],
  [COLLECTIONS.AGENTS, { owner_id: 1, name: 1 }, { unique: true }],
  [COLLECTIONS.AGENT_TOKENS, { token_hash: 1 }, {}],
];

// Indexes from older versions of this script that the ones above replace.
const oldIndexes = [[COLLECTIONS.TICKETS, "status_1"]];

// ---------- Run ----------

const { client, db } = await connect();
try {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));

  for (const [name, schema] of Object.entries(validators)) {
    const rules = { validator: { $jsonSchema: schema }, validationLevel: "strict", validationAction: "error" };
    if (existing.has(name)) {
      await db.command({ collMod: name, ...rules });
      console.log(`updated rules  ${name}`);
    } else {
      await db.createCollection(name, rules);
      console.log(`created        ${name}`);
    }
  }

  for (const [name, keys, options] of indexes) {
    const indexName = await db
      .collection(name)
      .createIndex(keys, options)
      .catch((err) => {
        if (err.code !== 11000) throw err;
        // Old documents already break the "unique" rule (often a missing field,
        // which counts as null). Fix or replace them, then run setup again.
        throw new Error(
          `Can't create unique index on ${name} ${JSON.stringify(keys)}: existing documents share the value ` +
            `${JSON.stringify(err.keyValue)}. Run "npm run db:seed" to replace them with fresh sample data, then run setup again.`,
        );
      });
    console.log(`index          ${name}.${indexName}${options.unique ? " (unique)" : ""}`);
  }

  for (const [name, indexName] of oldIndexes) {
    const exists = (await db.collection(name).indexes()).some((i) => i.name === indexName);
    if (exists) {
      await db.collection(name).dropIndex(indexName);
      console.log(`dropped old    ${name}.${indexName}`);
    }
  }

  console.log(`\nDone. Database "${db.databaseName}" is ready.`);
} finally {
  await client.close();
}
