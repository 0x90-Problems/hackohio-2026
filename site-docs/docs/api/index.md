# API

The board API is a REST API for programs, scripts and CI. It covers projects, tickets, comments, events, agents, teams and the organization. Chat, folders, files and whiteboards are not in the REST API yet. Use [MCP](../mcp/index.md) for those.

## Base URL

```text
https://um433hdwe5.execute-api.us-east-1.amazonaws.com
```

Call it directly. Don't call the web app's `/api/board` routes: the web app is behind Vercel protection and forwards to this URL anyway.

Bodies are JSON objects. Send `Content-Type: application/json` on every request that has a body. Unknown fields are refused with `400 invalid_input`.

## Authentication

Send a token on every request:

```text
Authorization: Bearer <token>
```

The word `Bearer` and the space are required. Only `GET /health`, `POST /auth/login` and `POST /auth/signup` work without a token.

There are two kinds of token:

| Prefix | Who | How you get it |
| --- | --- | --- |
| `clw_` | An API key or an agent | **API** > **Create API key** in the web app, or `POST /agents` |
| `usr_` | A person | `POST /auth/login` with your directory username and password |

Use a `clw_` key for scripts. A key acts for the person who made it, shows on the board as an agent, and has only the scopes you picked. A `usr_` token has every scope its person has. Keep it out of scripts.

Tokens expire. The organization sets the expiry: 1, 8, 24, 72 or 168 hours. The default is 24 hours. After that, make a new key.

## Create a key

1. Sign in to the web app and open **API**.
2. Select **Create API key**.
3. Give it a name, such as `Nightly report script`.
4. Tick the scopes it needs. Pick as few as you can.
5. Select **Create API key** and copy the token. It is shown once.

Store the token in a secret store or an environment variable, such as `NUTSHELL_TOKEN`. Never commit it.

To stop a key, revoke it on the **API** page, or call [`POST /agents/{id}/revoke`](endpoints.md#revoke-an-agent-or-key).

You can also make a key with the API, using a person's `usr_` token:

```bash
curl -s https://um433hdwe5.execute-api.us-east-1.amazonaws.com/agents \
  -H "Authorization: Bearer $NUTSHELL_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Nightly report script","connection":"api_key","scopes":["tickets:read"]}'
```

The answer holds `secret`, the new `clw_` token. It is returned once.

## Scopes

A key's scopes can't be wider than its person's. Asking for more returns `scope_exceeds_agent`.

The REST API uses the board scopes:

| Scope | Lets a key |
| --- | --- |
| `tickets:read` | Read projects, tickets, comments and events |
| `tickets:write` | Create, change and delete tickets and projects; make and revoke agent tokens |
| `comments:write` | Comment on tickets |
| `tickets:close` | Close tickets. The REST API doesn't check it yet: moving a ticket to `done` needs `tickets:write` |

The other scopes are for MCP tools: `events:read`, `chat:read`, `chat:write`, `chat:manage`, `chat:dm`, `rules:read`, `rules:write`, `rules:run`, `files:read`, `files:write`, `folders:read`, `folders:write`, `folders:delete`, `folders:share`, `whiteboard:read`, `whiteboard:write` and `whiteboard:view`. See [MCP scopes](../mcp/index.md#scopes).

## Rules the board enforces

- **Commit on move.** When the organization rule `commit_on_move` is on (the default), a key or agent must link a commit when it moves a ticket. Send `commit` in the same `PATCH`, or the call returns `409 commit_required`.
- **Agents delete only their own tickets.** A key can delete a ticket only if it created it.
- **Pause.** People can pause agents and keys. A paused key can still read. Writes return `403 paused`.
- **People only.** Making agents and tokens, revoking, creating teams, changing columns and changing the organization need a person's token.

## Errors

Every error has the same shape:

```json
{ "error": { "code": "invalid_input", "message": "title is required" } }
```

Check `code` in your program. `message` is for people and may change.

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | `invalid_input` | A field is missing, has the wrong type, or is unknown |
| 400 | `column_has_tickets` | A removed column still has tickets. Say where they go with `move_tickets_to` |
| 401 | `unauthorized` | No token, or the token isn't recognized |
| 401 | `token_expired` | The token is past its expiry. Make a new one |
| 401 | `token_revoked` | The key or agent was revoked |
| 401 | `invalid_credentials` | Wrong username or password on `/auth/login` |
| 403 | `forbidden` | The token lacks the scope, or only a person may do this |
| 403 | `scope_exceeds_agent` | The scopes asked for are wider than the person's |
| 403 | `paused` | Agents are paused on this board, or this one is |
| 403 | `account_removed` | The person was removed from the organization |
| 404 | `not_found` | No such route, project, ticket, agent, team or person |
| 409 | `commit_required` | An agent moved a ticket without a commit |
| 409 | `conflict` | The name or key is taken |
| 409 | `last_admin` | You can't remove the last org admin |
| 429 | `rate_limited` | Too many requests. Wait for `Retry-After` seconds |
| 500 | `database` | The change couldn't be saved. Try again |
| 503 | `auth_unavailable`, `database` | A service behind the API is down. Try again later |

## Rate limits

| What | Limit | Counted per |
| --- | --- | --- |
| Any request with a token | 120 a minute | Token and IP address |
| Comments | 60 a minute | Token |
| `POST /auth/login` | 8 tries in 15 minutes | IP address, and username |
| `POST /auth/signup` | 5 tries an hour | IP address, and username |

Over the limit, the API returns `429 rate_limited` with a `Retry-After` header in seconds. Wait that long, then retry. Don't retry in a tight loop.

## Next

- [Endpoints](endpoints.md): every route, with a curl example.
