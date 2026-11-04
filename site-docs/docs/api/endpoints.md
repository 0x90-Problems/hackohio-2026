# Endpoints

Every route of the board API. Paths are relative to the base URL:

```bash
export NUTSHELL_API=https://um433hdwe5.execute-api.us-east-1.amazonaws.com
export NUTSHELL_TOKEN=clw_...   # your API key
```

The examples use those two variables. "Scope" is the scope the token needs. "People only" means a `usr_` token is required: an API key gets `403 forbidden`.

Path parts such as `{key}` must be URL-encoded.

## Summary

| Method | Path | What it does | Scope |
| --- | --- | --- | --- |
| `GET` | [`/health`](#health) | Check the API is up | none |
| `POST` | [`/auth/login`](#sign-in) | Sign in and get a `usr_` token | none |
| `POST` | [`/auth/signup`](#sign-up) | Create a person and get a `usr_` token | none |
| `GET` | [`/board`](#board-snapshot) | Everything the board page shows | `tickets:read` |
| `GET` | [`/project-templates`](#list-templates) | List project templates | `tickets:read` |
| `GET` | [`/project-templates/{id}`](#read-a-template) | Read one template | `tickets:read` |
| `GET` | [`/projects`](#list-projects) | List the projects you can see | `tickets:read` |
| `POST` | [`/projects`](#create-a-project) | Create a project | `tickets:write` |
| `GET` | [`/projects/{key}/table`](#read-a-project-as-a-table) | Read a project as groups and rows | `tickets:read` |
| `PATCH` | [`/projects/{key}`](#change-a-project) | Change columns, team, or archive | `tickets:write` |
| `DELETE` | [`/projects/{key}`](#delete-a-project) | Delete a project | `tickets:write` |
| `GET` | [`/tickets`](#list-tickets) | List tickets | `tickets:read` |
| `POST` | [`/tickets`](#create-a-ticket) | Create a ticket | `tickets:write` |
| `POST` | [`/ticket-keys`](#reserve-a-ticket-key) | Reserve the next ticket key | `tickets:write` |
| `GET` | [`/tickets/{key}`](#read-a-ticket) | Read one ticket | `tickets:read` |
| `PATCH` | [`/tickets/{key}`](#change-a-ticket) | Change, move, or link a commit | `tickets:write` |
| `DELETE` | [`/tickets/{key}`](#delete-a-ticket) | Delete a ticket | `tickets:write` |
| `GET` | [`/tickets/{key}/comments`](#read-comments) | Read comments | `tickets:read` |
| `POST` | [`/tickets/{key}/comments`](#add-a-comment) | Add a comment | `comments:write` |
| `GET` | [`/events`](#events) | Board events, or a live stream | `tickets:read` |
| `GET` | [`/agents`](#list-agents-and-keys) | List agents and keys | none |
| `POST` | [`/agents`](#create-an-agent-or-key) | Create an agent or key | people only |
| `POST` | [`/agents/{id}/tokens`](#make-a-new-token) | Make a new token for an agent | people only, `tickets:write` |
| `POST` | [`/agents/{id}/revoke`](#revoke-an-agent-or-key) | Revoke an agent or key | people only, `tickets:write` |
| `GET` | [`/users`](#list-people) | List people | none |
| `GET` | [`/users/{user_id}/removal`](#preview-removing-a-person) | What removing someone would stop | org admins |
| `DELETE` | [`/users/{user_id}`](#remove-a-person) | Remove someone from the organization | org admins |
| `GET` | [`/teams`](#list-teams) | List teams | none |
| `POST` | [`/teams`](#create-a-team) | Create a team | people only |
| `POST` | [`/teams/{team}/members`](#add-a-team-member) | Add a member | team managers |
| `DELETE` | [`/teams/{team}/members/{user_id}`](#remove-a-team-member) | Remove a member | team managers |
| `PUT` | [`/teams/{team}/managers/{user_id}`](#set-a-team-manager) | Make or unmake a manager | team managers |
| `POST` | [`/teams/rename`](#rename-a-team) | Rename a team | team managers |
| `GET` | [`/organization`](#read-the-organization) | Name, token expiry and rules | none |
| `PATCH` | [`/organization`](#change-the-organization) | Change name, token expiry or rules | org admins |
| `POST` | `/mcp` | The MCP endpoint. Agents should use the [MCP gateway](../mcp/index.md) instead | |

## Health and sign-in

### Health

`GET /health` returns `{"status":"ok"}`. No token needed.

```bash
curl -s $NUTSHELL_API/health
```

### Sign in

`POST /auth/login` checks a directory username and password and returns a person token (`usr_`). The password is not stored by NutShell.

| Field | Type | Required |
| --- | --- | --- |
| `username` | string | yes |
| `password` | string | yes |

```bash
curl -s $NUTSHELL_API/auth/login -H "Content-Type: application/json" \
  -d '{"username":"dylan","password":"..."}'
```

Wrong details return `401 invalid_credentials`. Limit: 8 tries in 15 minutes.

### Sign up

`POST /auth/signup` creates a person and returns a person token. Answers `201`.

| Field | Type | Required |
| --- | --- | --- |
| `username` | string | yes |
| `password` | string, 8 or more characters | yes |
| `name` | string | yes |
| `email` | string | no |
| `team` | string | no |

## Board and projects

### Board snapshot

`GET /board` returns everything the board page needs, limited to what the token can see.

```bash
curl -s $NUTSHELL_API/board -H "Authorization: Bearer $NUTSHELL_TOKEN"
```

### List templates

`GET /project-templates` lists the templates. Each one is a `board`, a `table` or a `roadmap`. The ids are `blank`, `kanban`, `iterative-development`, `product-launch`, `team-retrospective`, `team-planning`, `feature-release`, `bug-tracker` and `roadmap`.

### Read a template

`GET /project-templates/{id}` returns one template: its layout, columns, fields and starter tags. An unknown id returns `404`.

```bash
curl -s $NUTSHELL_API/project-templates/kanban -H "Authorization: Bearer $NUTSHELL_TOKEN"
```

### List projects

`GET /projects` lists the projects the token can see.

### Create a project

`POST /projects` creates a project from a template. Answers `201`. You must be on the team, unless you are an org admin.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | yes | |
| `key` | string | yes | Ticket keys start with it, such as `NSB-12` |
| `template` | string | yes | A template id |
| `team` | string | no | Defaults to your team |

```bash
curl -s $NUTSHELL_API/projects -H "Authorization: Bearer $NUTSHELL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Release 2","key":"REL","template":"kanban"}'
```

### Read a project as a table

`GET /projects/{key}/table` returns the project as groups and rows, with its layout, columns and fields.

### Change a project

`PATCH /projects/{key}` does one of three things, depending on the body:

| Body | What it does |
| --- | --- |
| `{"columns": [...], "move_tickets_to": "slug"}` | Replace the columns. People only. 1 to 30 columns, names up to 100 characters. If a removed column has tickets, `move_tickets_to` says where they go (else `400 column_has_tickets`) |
| `{"team": "Team name"}` | Move the project to another team |
| `{"archived": true}` | Archive the project, or `false` to bring it back |

```bash
curl -s -X PATCH $NUTSHELL_API/projects/REL -H "Authorization: Bearer $NUTSHELL_TOKEN" \
  -H "Content-Type: application/json" -d '{"archived":true}'
```

### Delete a project

`DELETE /projects/{key}` deletes the project and returns `{"key": "..."}`.

## Tickets

A ticket looks like this:

```json
{
  "key": "NSB-12",
  "title": "Write the docs",
  "label": "docs",
  "status": "in_progress",
  "created_by": { "type": "agent", "id": "agent_...", "acting_for": "user_id" },
  "reviewer_id": "user_id",
  "needs_approval": false,
  "linked_commits": [],
  "start_date": "2026-11-01",
  "due_date": "2026-11-08",
  "created_at": "2026-11-01T15:04:05.000Z"
}
```

`status` is a column slug on the ticket's project, such as `backlog`, `in_progress`, `in_review` or `done`. Projects can have their own columns.

### List tickets

`GET /tickets` lists the tickets the token can see. Add `?status=<slug>` for one column.

```bash
curl -s "$NUTSHELL_API/tickets?status=in_review" -H "Authorization: Bearer $NUTSHELL_TOKEN"
```

### Create a ticket

`POST /tickets` creates a ticket and returns it with `201`.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `title` | string | yes | |
| `project` | string | no | Project key. Defaults to the token's first project |
| `status` | string | no | Column slug. Defaults to the project's first column |
| `label` | string | no | |
| `reviewer_id` | string | no | A person's id |
| `start_date` | string | no | `YYYY-MM-DD`. On or before `due_date` |
| `due_date` | string | no | `YYYY-MM-DD` |

```bash
curl -s $NUTSHELL_API/tickets -H "Authorization: Bearer $NUTSHELL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Nightly build failed","project":"NSB","label":"ci"}'
```

### Reserve a ticket key

`POST /ticket-keys` returns the next free key, such as `{"key":"NSB-13"}`. Optional body: `{"project": "NSB"}`.

### Read a ticket

`GET /tickets/{key}` returns one ticket.

```bash
curl -s $NUTSHELL_API/tickets/NSB-12 -H "Authorization: Bearer $NUTSHELL_TOKEN"
```

### Change a ticket

`PATCH /tickets/{key}` changes any of these fields and returns the ticket. Send only the fields you change.

| Field | Type | Notes |
| --- | --- | --- |
| `title` | string | Can't be empty |
| `label` | string | |
| `status` | string | Column slug. Moves the ticket |
| `reviewer_id` | string | |
| `start_date` | string | `YYYY-MM-DD`, or `""` to clear |
| `due_date` | string | `YYYY-MM-DD`, or `""` to clear |
| `commit` | object | Links a commit: `sha`, `message`, `added`, `removed` (line counts), and optional `repo` |

`repo` is a repository name in the 0x90-Problems GitHub org, such as `hackohio-2026`. The board uses it to link the commit to GitHub.

An API key that moves a ticket must link a commit in the same call while the `commit_on_move` rule is on. Otherwise it gets `409 commit_required`.

```bash
curl -s -X PATCH $NUTSHELL_API/tickets/NSB-12 -H "Authorization: Bearer $NUTSHELL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"in_review","commit":{"sha":"'"$GITHUB_SHA"'","message":"Fix the build","added":12,"removed":3,"repo":"hackohio-2026"}}'
```

To link a commit without moving the ticket, send only `commit`.

### Delete a ticket

`DELETE /tickets/{key}` soft-deletes a ticket and returns `{"key": "..."}`. A key can delete only a ticket it created.

## Comments

### Read comments

`GET /tickets/{key}/comments` lists the comments. Add `?since=<ISO time>` for new ones only.

```bash
curl -s "$NUTSHELL_API/tickets/NSB-12/comments?since=2026-11-01T00:00:00Z" \
  -H "Authorization: Bearer $NUTSHELL_TOKEN"
```

### Add a comment

`POST /tickets/{key}/comments` adds a comment and returns it with `201`. Body: `{"body": "..."}`, 1 to 8,000 characters. Limit: 60 comments a minute.

```bash
curl -s $NUTSHELL_API/tickets/NSB-12/comments -H "Authorization: Bearer $NUTSHELL_TOKEN" \
  -H "Content-Type: application/json" -d '{"body":"Build is green again."}'
```

## Events

`GET /events` returns board events, newest first. Add `?since=<ISO time>` for new ones only. Each event has `action`, `ticket_key`, `actor`, `details` and `created_at`. Actions include `ticket_created`, `ticket_moved`, `ticket_updated`, `ticket_deleted`, `ticket_closed`, `comment_added`, `commit_linked` and `person_removed`.

```bash
curl -s "$NUTSHELL_API/events?since=2026-11-04T00:00:00Z" -H "Authorization: Bearer $NUTSHELL_TOKEN"
```

Send `Accept: text/event-stream` to get Server-Sent Events instead. Each event comes as a `data:` line of JSON.

```bash
curl -N $NUTSHELL_API/events -H "Authorization: Bearer $NUTSHELL_TOKEN" -H "Accept: text/event-stream"
```

## Agents and keys

An API key is an agent whose `connection` is `api_key`. An MCP agent has `connection` `mcp`.

### List agents and keys

`GET /agents` lists agents and keys with their owner, scopes, `revoked`, `last_used_at` and `expired`. It never returns a token.

### Create an agent or key

`POST /agents` creates an agent and its first token. People only. Answers `201` with `agent`, `secret` (the token, shown once), `token` (its details) and `mcp` (install snippets).

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | yes | |
| `scopes` | array of scope names | yes | Can't be wider than yours |
| `connection` | `mcp` or `api_key` | no | Use `api_key` for scripts |

### Make a new token

`POST /agents/{id}/tokens` makes a new token for an agent you own, for example after the old one expired. Body: `{"scopes": [...]}`. Answers `201` with `secret`, shown once.

### Revoke an agent or key

`POST /agents/{id}/revoke` revokes an agent you own and all its tokens. Its next call gets `401 token_revoked`.

```bash
curl -s -X POST $NUTSHELL_API/agents/agent_0123abcd/revoke -H "Authorization: Bearer $NUTSHELL_USER_TOKEN"
```

## People and teams

### List people

`GET /users` lists the people in the organization. Removed people are left out.

### Preview removing a person

`GET /users/{user_id}/removal` says how many of the person's agents still work and how many live tokens removing them would stop. Org admins only.

### Remove a person

`DELETE /users/{user_id}` removes someone from the organization. Org admins only. It takes them off every team, deletes their agents and every token, and blocks their sign-in. Their name stays on tickets, comments, events and files. You can't remove yourself (`403`) or the last org admin (`409 last_admin`).

### List teams

`GET /teams` lists teams with their members.

### Create a team

`POST /teams` with `{"name": "..."}`. People only. You become its manager. A taken name returns `409 conflict`.

### Add a team member

`POST /teams/{team}/members` with `{"user_id": "..."}`. Team managers only.

### Remove a team member

`DELETE /teams/{team}/members/{user_id}`. Team managers only.

### Set a team manager

`PUT /teams/{team}/managers/{user_id}` with `{"manager": true}` or `false`. The person must be on the team first.

### Rename a team

`POST /teams/rename` with `{"from": "Old", "to": "New"}`. Every member moves to the new name. `GET /teams` lists the old name in `previous_names`.

## Organization

### Read the organization

`GET /organization` returns `name`, `token_expiry_hours`, `ticket_prefix` and `rules`.

```bash
curl -s $NUTSHELL_API/organization -H "Authorization: Bearer $NUTSHELL_TOKEN"
```

### Change the organization

`PATCH /organization` changes any of these. Org admins only, with a person token.

| Field | Type | Notes |
| --- | --- | --- |
| `name` | string | Can't be empty |
| `token_expiry_hours` | integer | `1`, `8`, `24`, `72` or `168` |
| `rules` | object | `approve_before_close`, `commit_on_move`, `log_agent_actions`, each `true` or `false` |
