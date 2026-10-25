// MongoDB $jsonSchema for every collection this app writes.
// The rules list the fields the UI and the board API actually store.
// additionalProperties is false so an unknown field is rejected.
import {
  ACTOR_FIELDS,
  ACTOR_TYPES,
  AGENT_CONNECTION,
  ALL_SCOPES,
  CATEGORY_COLORS,
  CATEGORY_SLUG_PATTERN,
  COLLECTIONS,
  EVENT_ACTIONS,
  PROJECT_KEY_PATTERN,
  PROJECT_TEMPLATES,
  TOKEN_PREFIX,
} from "../../shared/names.ts";

const text = { bsonType: "string" };
const date = { bsonType: "date" };
const bool = { bsonType: "bool" };
const projectKey = { bsonType: "string", pattern: PROJECT_KEY_PATTERN };
const categorySlug = { bsonType: "string", pattern: CATEGORY_SLUG_PATTERN };
const textList = { bsonType: "array", items: text, uniqueItems: true };
const scopeList = { bsonType: "array", items: { enum: ALL_SCOPES }, uniqueItems: true };
const whole = { bsonType: ["int", "long", "double"], minimum: 0 };

const actor = {
  bsonType: "object",
  required: [ACTOR_FIELDS.TYPE, ACTOR_FIELDS.ID],
  properties: {
    [ACTOR_FIELDS.TYPE]: { enum: Object.values(ACTOR_TYPES) },
    [ACTOR_FIELDS.ID]: text,
    [ACTOR_FIELDS.NAME]: text,
    [ACTOR_FIELDS.ACTING_FOR]: text,
  },
  additionalProperties: false,
  anyOf: [
    {
      properties: { [ACTOR_FIELDS.TYPE]: { enum: [ACTOR_TYPES.HUMAN] } },
      not: { required: [ACTOR_FIELDS.ACTING_FOR] },
    },
    {
      properties: { [ACTOR_FIELDS.TYPE]: { enum: [ACTOR_TYPES.AGENT] } },
      required: [ACTOR_FIELDS.ACTING_FOR],
    },
  ],
};

const category = {
  bsonType: "object",
  required: ["slug", "name", "color", "order"],
  properties: {
    slug: categorySlug,
    name: text,
    color: { enum: [...CATEGORY_COLORS] },
    order: whole,
  },
  additionalProperties: false,
};

const commit = {
  bsonType: "object",
  required: ["sha", "message", "added", "removed"],
  properties: {
    sha: text,
    message: text,
    added: { bsonType: ["int", "long", "double"], minimum: 0 },
    removed: { bsonType: ["int", "long", "double"], minimum: 0 },
  },
  additionalProperties: false,
};

const eventDetails = {
  bsonType: "object",
  properties: {
    from: text,
    to: text,
    body: text,
    sha: text,
    title: text,
    status: text,
  },
  additionalProperties: false,
};

export const validators = {
  [COLLECTIONS.USERS]: {
    bsonType: "object",
    required: ["_id", "auth_username", "name", "team", "type"],
    properties: {
      _id: text,
      auth_username: text,
      name: text,
      role: text,
      admin: bool,
      team: text,
      type: { enum: [ACTOR_TYPES.HUMAN] },
    },
    additionalProperties: false,
  },
  [COLLECTIONS.PROJECTS]: {
    bsonType: "object",
    required: ["key", "name", "team", "categories", "created_by", "created_at"],
    properties: {
      _id: { bsonType: ["string", "objectId"] },
      key: projectKey,
      name: text,
      description: text,
      team: text,
      template: { enum: Object.values(PROJECT_TEMPLATES) },
      layout: { enum: ["board", "table", "roadmap"] },
      fields: textList,
      categories: { bsonType: "array", minItems: 1, items: category },
      starter_tags: textList,
      archived: bool,
      created_by: actor,
      created_at: date,
    },
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
    additionalProperties: false,
  },
  [COLLECTIONS.AGENT_TOKENS]: {
    bsonType: "object",
    required: ["agent_id", "token_prefix", "token_hash", "scopes", "created_at", "expires_at", "revoked"],
    properties: {
      _id: { bsonType: ["string", "objectId"] },
      agent_id: text,
      user_id: text,
      token_prefix: { bsonType: "string", pattern: `^${TOKEN_PREFIX}` },
      token_hash: text,
      scopes: scopeList,
      created_at: date,
      expires_at: date,
      last_used_at: { bsonType: ["date", "null"] },
      revoked: bool,
    },
    additionalProperties: false,
  },
  [COLLECTIONS.TICKETS]: {
    bsonType: "object",
    required: ["key", "project_key", "title", "status", "created_by", "created_at"],
    properties: {
      _id: { bsonType: ["string", "objectId"] },
      key: text,
      project_key: projectKey,
      title: text,
      tags: textList,
      label: text,
      status: categorySlug,
      created_by: actor,
      reviewer_id: text,
      needs_approval: bool,
      approved_by: actor,
      approved_at: date,
      owner_id: text,
      due_date: { bsonType: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      description: text,
      card_color: { enum: [...CATEGORY_COLORS] },
      fields: { bsonType: "object", additionalProperties: text },
      linked_commits: { bsonType: "array", items: commit },
      deleted_at: date,
      created_at: date,
    },
    additionalProperties: false,
  },
  [COLLECTIONS.COMMENTS]: {
    bsonType: "object",
    required: ["ticket_key", "author", "body", "created_at"],
    properties: {
      _id: text,
      ticket_key: text,
      author: actor,
      body: text,
      created_at: date,
    },
    additionalProperties: false,
  },
  [COLLECTIONS.EVENTS]: {
    bsonType: "object",
    required: ["action", "ticket_key", "project_key", "actor", "created_at"],
    properties: {
      _id: text,
      action: { enum: Object.values(EVENT_ACTIONS) },
      ticket_key: text,
      project_key: projectKey,
      actor: actor,
      details: eventDetails,
      created_at: date,
    },
    additionalProperties: false,
  },
  ticket_counters: {
    bsonType: "object",
    required: ["_id", "seq"],
    properties: {
      _id: projectKey,
      seq: whole,
    },
    additionalProperties: false,
  },
};
