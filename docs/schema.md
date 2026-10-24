# Database Schema — 0x90 Problems

Oct 24, 2026 (updated: login and passwords handled by Authelia)

## Overview

One MongoDB database named `hackathon` holds six collections: `users`, `agents`, `agent_tokens`, `tickets`, `comments` and `events`. It runs locally for now and moves to AWS DocumentDB (MongoDB-compatible) for the event. MongoDB does not enforce this schema, so every person and agent writing to the database should follow this doc exactly.

**No passwords are stored in this database, hashed or plain.** Authelia handles all human passwords and login.

### How we tell humans from agents

Every action stores an **actor** object. The board reads `type` to show a solid circle (human) or the dashed AGENT tag.

```json
{ "type": "human", "id": "user_raddy" }
{ "type": "agent", "id": "agent_raddy_claude", "acting_for": "user_raddy" }
```

`acting_for` is required when `type` is `agent` and left out when it is `human`. The field is named `created_by` on tickets, `author` on comments and `actor` on events.

### Shared word lists

Use these exact spellings everywhere. They should also go in the team's shared claims file.

| List | Allowed values |
|---|---|
| Ticket status | `backlog`, `in_progress`, `in_review`, `done` |
| Actor type | `human`, `agent` |
| Agent connection | `mcp`, `api_key` |
| Token scopes | `tickets:read`, `tickets:write`, `comments:write`, `tickets:close` |
| Event action | `ticket_created`, `ticket_moved`, `comment_added`, `commit_linked`, `ticket_closed` |

### Naming rules

- Collection and field names are lowercase with underscores, no spaces.
- References to another document end in `_id` (like `owner_id`) and hold that document's `_id`.
- Dates are stored as real dates, typed in Compass as `{ "$date": "2026-10-24T14:00:00Z" }`, in UTC.
- Sample data uses readable ids like `user_raddy`; the live app may use MongoDB's generated ids instead.

## users

One document per human on the team.

| Field | Type | Required | Example | Notes |
|---|---|---|---|---|
| `_id` | text | yes | `user_raddy` | Unique id |
| `auth_username` | text | yes | `raddy` | The username this person logs in with through Authelia. Links a login to this user. Unique. |
| `name` | text | yes | `Raddy` | Shown on cards and comments |
| `role` | text | no | `UI design / database design` | Shown on the Teams page |
| `team` | text | yes | `0x90 Problems` | Team the person belongs to |
| `type` | text | yes | `human` | Always `human` here |

How login works: the person signs in through Authelia, Authelia checks the password, and the app looks up the user whose `auth_username` matches. Never add a password field to this collection.

## agents

One document per AI agent. Every agent belongs to exactly one user.

| Field | Type | Required | Example | Notes |
|---|---|---|---|---|
| `_id` | text | yes | `agent_raddy_claude` | Unique id |
| `name` | text | yes | `Claude Code` | Shown on the AGENT tag |
| `owner_id` | text | yes | `user_raddy` | The user this agent acts for |
| `connection` | text | yes | `mcp` | `mcp` or `api_key` |
| `scopes` | list of text | yes | `["tickets:write", "comments:write"]` | What the agent may do |
| `revoked` | true/false | yes | `false` | The Revoke button sets this to `true` |

Rule: an agent's `scopes` can never be more than its owner is allowed to do.

## agent_tokens

The login tokens agents send on every request. An agent can have several (an old expired one plus a current one). These are agent tokens, not human passwords, so they are still stored as hashes.

| Field | Type | Required | Example | Notes |
|---|---|---|---|---|
| `agent_id` | text | yes | `agent_raddy_claude` | The agent this token belongs to |
| `token_prefix` | text | yes | `clw_rd` | First few characters, shown as `clw_rd••••••` |
| `token_hash` | text | yes | `fake-hash-raddy` | Scrambled token; never store the real one |
| `scopes` | list of text | yes | `["tickets:write"]` | Must fit inside the agent's scopes |
| `created_at` | date | yes | `2026-10-24T10:00:00Z` | When it was made |
| `expires_at` | date | yes | `2026-10-25T10:00:00Z` | Set by the org's expiry rule (24 h) |
| `last_used_at` | date or null | no | `null` | Powers "Last active" on the Agents page |
| `revoked` | true/false | yes | `false` | `true` = rejected right away |

A token is valid only when its hash matches, `revoked` is `false` and `expires_at` is in the future. The sample data includes one expired and one revoked token for testing.

## tickets

One document per card on the board.

| Field | Type | Required | Example | Notes |
|---|---|---|---|---|
| `key` | text | yes | `CLW-05` | Unique, shown on the card |
| `title` | text | yes | `MongoDB schema: tickets, agents` | Card title |
| `label` | text | no | `Database` | Category tag on the card |
| `status` | text | yes | `in_review` | One of the four status words |
| `created_by` | actor | yes | `{ "type": "agent", "id": "agent_raddy_claude", "acting_for": "user_raddy" }` | Who made the ticket |
| `reviewer_id` | text | no | `user_dylan` | Human who approves it |
| `needs_approval` | true/false | yes | `true` | Shows "Needs human approval" |
| `linked_commits` | list | no | `[{ "sha": "abc1234", "message": "Add tickets collection", "added": 20, "removed": 2 }]` | Required when an agent moves a ticket |
| `created_at` | date | yes | `2026-10-24T14:00:00Z` | When it was made |

Each entry in `linked_commits` has `sha` (text), `message` (text), `added` (number) and `removed` (number).

## comments

One document per comment on a ticket, from a person or an agent.

| Field | Type | Required | Example | Notes |
|---|---|---|---|---|
| `ticket_key` | text | yes | `CLW-05` | Ticket the comment is on |
| `author` | actor | yes | `{ "type": "human", "id": "user_raddy" }` | Who wrote it |
| `body` | text | yes | `Add an index on ticket status so the board loads fast.` | The comment text |
| `created_at` | date | yes | `2026-10-24T14:09:00Z` | When it was posted |

Agents subscribed to a ticket are notified when a comment is added.

## events

The activity log behind the Live activity feed and the audit trail. Every move, comment, commit link and close adds one document; events are never edited or deleted.

| Field | Type | Required | Example | Notes |
|---|---|---|---|---|
| `action` | text | yes | `ticket_moved` | One of the event action words |
| `ticket_key` | text | yes | `CLW-05` | Ticket it happened on |
| `actor` | actor | yes | `{ "type": "agent", "id": "agent_raddy_claude", "acting_for": "user_raddy" }` | Who did it |
| `details` | object | no | `{ "from": "in_progress", "to": "in_review" }` | Depends on the action |
| `created_at` | date | yes | `2026-10-24T14:05:00Z` | When it happened |

## Indexes

| Collection | Field(s) | Why |
|---|---|---|
| `users` | `auth_username` (unique) | Find the user fast after Authelia login; no duplicates |
| `tickets` | `status` | Board loads each column fast (created) |
| `tickets` | `key` (unique) | No two tickets share a key |
| `comments` | `ticket_key` | Ticket panel loads its comments fast |
| `events` | `created_at` (newest first) | Live activity feed |
| `agent_tokens` | `token_hash` | Fast token check on every request |

## Open questions for Dylan

- Do these collection and field names match the API endpoints?
- Are the status words and scope names final? Add them to the shared claims file.
- Can the backend on Vercel reach DocumentDB, or do we move it to ECS or use Atlas?
- Confirm: passwords live only in Authelia, and nothing password-related goes in MongoDB?
- Agent tokens are still stored as `token_hash`. Keep that? (Recommended: yes.)
- Live app: readable ids like `user_raddy`, or MongoDB's generated ids?

## Prior work

This schema draft and the sample data in a local MongoDB were made before the event (night of Oct 23–24). List them in the project's prior-work disclosure.
