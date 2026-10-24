// Creates the six collections, their validation rules and their indexes,
// exactly as described in docs/schema.md.
//
// Safe to run more than once: existing collections get their rules updated,
// existing indexes are left alone, and no data is deleted.
//
// Run with: npm run db:setup
import { connect } from "./connect.js";
import {
  ACTOR_FIELDS,
  ACTOR_TYPES,
  AGENT_CONNECTION,
  ALL_SCOPES,
  COLLECTIONS,
  EVENT_ACTIONS,
  TICKET_STATUS,
  TOKEN_PREFIX,
} from "../shared/names.ts";

// ---------- Reusable pieces ----------

const text = { bsonType: "string" };
const date = { bsonType: "date" };
const bool = { bsonType: "bool" };
const scopeList = {
  bsonType: "array",
  items: { enum: ALL_SCOPES },
  uniqueItems: true,
};

// The actor object: { type, id } for a human, { type, id, acting_for } for an agent.
const actor = {
  bsonType: "object",
  required: [ACTOR_FIELDS.TYPE, ACTOR_FIELDS.ID],
  properties: {
    [ACTOR_FIELDS.TYPE]: { enum: Object.values(ACTOR_TYPES) },
    [ACTOR_FIELDS.ID]: text,
    [ACTOR_FIELDS.ACTING_FOR]: text,
  },
  additionalProperties: false,
  anyOf: [
    // Human: acting_for must be left out.
    {
      properties: { [ACTOR_FIELDS.TYPE]: { enum: [ACTOR_TYPES.HUMAN] } },
      not: { required: [ACTOR_FIELDS.ACTING_FOR] },
    },
    // Agent: acting_for is required.
    {
      properties: { [ACTOR_FIELDS.TYPE]: { enum: [ACTOR_TYPES.AGENT] } },
      required: [ACTOR_FIELDS.ACTING_FOR],
    },
  ],
};

// ---------- One validation rule per collection ----------

const validators = {
  [COLLECTIONS.USERS]: {
    bsonType: "object",
    required: ["_id", "auth_username", "name", "team", "type"],
    properties: {
      _id: text,
      auth_username: text,
      name: text,
      role: text,
      team: text,
      type: { enum: [ACTOR_TYPES.HUMAN] },
    },
    // No extra fields allowed, so a password field can never be added here.
    additionalProperties: false,
  },

  [COLLECTIONS.AGENTS]: {
    bsonType: "object",
    required: ["_id", "name", "owner_id", "connection", "scopes", "revoked"],
    properties: {
      _id: text,
      name: text,
      owner_id: text,
      connection: { enum: Object.values(AGENT_CONNECTION) },
      scopes: scopeList,
      revoked: bool,
    },
  },

  [COLLECTIONS.AGENT_TOKENS]: {
    bsonType: "object",
    required: ["agent_id", "token_prefix", "token_hash", "scopes", "created_at", "expires_at", "revoked"],
    properties: {
      agent_id: text,
      token_prefix: { bsonType: "string", pattern: `^${TOKEN_PREFIX}` },
      token_hash: text,
      scopes: scopeList,
      created_at: date,
      expires_at: date,
      last_used_at: { bsonType: ["date", "null"] },
      revoked: bool,
    },
  },

  [COLLECTIONS.TICKETS]: {
    bsonType: "object",
    required: ["key", "title", "status", "created_by", "needs_approval", "created_at"],
    properties: {
      key: text,
      title: text,
      label: text,
      status: { enum: Object.values(TICKET_STATUS) },
      created_by: actor,
      reviewer_id: text,
      needs_approval: bool,
      linked_commits: {
        bsonType: "array",
        items: {
          bsonType: "object",
          required: ["sha", "message", "added", "removed"],
          properties: {
            sha: text,
            message: text,
            added: { bsonType: "number" },
            removed: { bsonType: "number" },
          },
        },
      },
      created_at: date,
    },
  },

  [COLLECTIONS.COMMENTS]: {
    bsonType: "object",
    required: ["ticket_key", "author", "body", "created_at"],
    properties: {
      ticket_key: text,
      author: actor,
      body: text,
      created_at: date,
    },
  },

  [COLLECTIONS.EVENTS]: {
    bsonType: "object",
    required: ["action", "ticket_key", "actor", "created_at"],
    properties: {
      action: { enum: Object.values(EVENT_ACTIONS) },
      ticket_key: text,
      actor: actor,
      details: { bsonType: "object" },
      created_at: date,
    },
  },
};

// ---------- Indexes (the "Indexes" table in docs/schema.md) ----------

const indexes = [
  [COLLECTIONS.USERS, { auth_username: 1 }, { unique: true }],
  [COLLECTIONS.TICKETS, { status: 1 }, {}],
  [COLLECTIONS.TICKETS, { key: 1 }, { unique: true }],
  [COLLECTIONS.COMMENTS, { ticket_key: 1 }, {}],
  [COLLECTIONS.EVENTS, { created_at: -1 }, {}], // -1 = newest first
  [COLLECTIONS.AGENT_TOKENS, { token_hash: 1 }, {}],
];

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

  console.log(`\nDone. Database "${db.databaseName}" is ready.`);
} finally {
  await client.close();
}
