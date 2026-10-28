# Database Schema — 0x90 Problems

Oct 24, 2026 (updated: login and passwords handled by Authelia; projects, per-project columns and tags added)

## Overview

One MongoDB database named `hackathon` holds seven collections: `users`, `projects`, `agents`, `agent_tokens`, `tickets`, `comments` and `events`. The team's shared copy runs on MongoDB Atlas (`cluster0.3pub20.mongodb.net`); a local MongoDB works the same way for testing. MongoDB does not enforce this schema, so every person and agent writing to the database should follow this doc exactly.

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
| Default ticket status | `backlog`, `in_progress`, `in_review`, `done` (the Blank template's columns; each project can have its own) |
| Category color | `gray`, `red`, `orange`, `amber`, `green`, `teal`, `pink` |
| Project template | `blank`, `team-planning`, `kanban`, `feature-release`, `bug-tracker`, `iterative-development`, `product-launch`, `roadmap`, `team-retrospective` |
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

## projects

One document per project. A team can have several, like GitHub repos, and each one is its own board with its own columns, tags and tickets.

| Field | Type | Required | Example | Notes |
|---|---|---|---|---|
| `key` | text | yes | `CLW` | Unique. 2–6 capital letters or digits, starting with a letter. Every ticket id in the project starts with it (`CLW-05`) |
| `name` | text | yes | `NutShell app` | Shown on the Projects page and board title |
| `description` | text | no | `The NutShell app we demo on Sunday.` | Shown on the project card |
| `team` | text | yes | `0x90 Problems` | Team that owns it, same as `users.team` |
| `template` | text | no | `blank` | The template it started from (one of the project template words) |
| `categories` | list | yes | see below | The board's columns, in order |
| `starter_tags` | list of text | no | `["Bug", "P0"]` | Tags the template suggests before any ticket uses them |
| `created_by` | actor | yes | `{ "type": "human", "id": "user_raddy" }` | Who made the project |
| `created_at` | date | yes | `2026-10-23T18:00:00Z` | When it was made |

Each entry in `categories` (a board column) has:

| Field | Type | Example | Notes |
|---|---|---|---|
| `slug` | text | `in_review` | Unique within the project; lowercase words joined by `_`. A ticket's `status` holds this |
| `name` | text | `In review` | Column title |
| `color` | text | `orange` | One of the category colors |
| `order` | number | `2` | 0 = leftmost column |

Columns named Backlog, In progress, In review and Done use the default status slugs, so Approve (moves to `done`) and Request changes (moves to `in_progress`) work on any project that has them.

Deleting a column moves its tickets to another column first; a column is never deleted while tickets point at it.

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
| `key` | text | yes | `CLW-05` | Unique, shown on the card. Starts with the project key |
| `project_key` | text | yes | `CLW` | The project this ticket belongs to (`projects.key`) |
| `title` | text | yes | `MongoDB schema: tickets, agents` | Card title |
| `tags` | list of text | no | `["Database", "Urgent"]` | Tags shown on the card; no duplicates |
| `status` | text | yes | `in_review` | The `slug` of one of the project's `categories` (the column it's in) |
| `created_by` | actor | yes | `{ "type": "agent", "id": "agent_raddy_claude", "acting_for": "user_raddy" }` | Who made the ticket |
| `reviewer_id` | text | no | `user_dylan` | Human who approves it |
| `needs_approval` | true/false | yes | `true` | Shows "Needs human approval" |
| `linked_commits` | list | no | `[{ "sha": "abc1234", "message": "Add tickets collection", "added": 20, "removed": 2 }]` | Required when an agent moves a ticket |
| `created_at` | date | yes | `2026-10-24T14:00:00Z` | When it was made |

Each entry in `linked_commits` has `sha` (text), `message` (text), `added` (number) and `removed` (number).

New tickets get the next number in their project: the highest `CLW-NN` plus one. `label` (one text) was replaced by `tags` (a list).

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
| `project_key` | text | yes | `CLW` | Project it happened in, so each board's Live activity loads fast |
| `actor` | actor | yes | `{ "type": "agent", "id": "agent_raddy_claude", "acting_for": "user_raddy" }` | Who did it |
| `details` | object | no | `{ "from": "in_progress", "to": "in_review" }` | Depends on the action. `from`/`to` are category slugs |
| `created_at` | date | yes | `2026-10-24T14:05:00Z` | When it happened |

## Indexes

| Collection | Field(s) | Why |
|---|---|---|
| `users` | `auth_username` (unique) | Find the user fast after Authelia login; no duplicates |
| `projects` | `key` (unique) | No two projects share a key |
| `projects` | `team` | Projects page lists a team's projects fast |
| `tickets` | `project_key` + `status` | Board loads each column of one project fast (replaces the old `status` index) |
| `tickets` | `key` (unique) | No two tickets share a key |
| `tickets` | text: `title`, `tags` | The "Search tickets…" box |
| `comments` | `ticket_key` | Ticket panel loads its comments fast |
| `events` | `project_key` + `created_at` (newest first) | One board's Live activity feed |
| `events` | `created_at` (newest first) | Home page "Recent changes" across all projects |
| `agent_tokens` | `token_hash` | Fast token check on every request |

## Open questions for Dylan

- Do these collection and field names match the API endpoints?
- Projects: categories are stored inside each project document (one read loads a whole board). OK for the API, or a separate `categories` collection?
- Are the status words and scope names final? Add them to the shared claims file.
- Can the backend on Vercel reach DocumentDB, or do we move it to ECS or use Atlas?
- Confirm: passwords live only in Authelia, and nothing password-related goes in MongoDB?
- Agent tokens are still stored as `token_hash`. Keep that? (Recommended: yes.)
- Live app: readable ids like `user_raddy`, or MongoDB's generated ids?

## Prior work

This schema draft and the sample data in a local MongoDB were made before the event (night of Oct 23–24). List them in the project's prior-work disclosure.
