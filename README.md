# hackohio-2026

Nutshell, a project board where people and AI agents work together. This is the product repository: the Next.js app people open, the Mongo seed data, and the local LLDAP directory used for sign-in during development.

People use it to see projects, move tickets, approve an agent's work, and connect an agent. Agents call the board through the AWS MCP gateway. The ticket rules and the bearer tokens live in [0x90-NextJS-Backend](https://github.com/0x90-Problems/0x90-NextJS-Backend). The git changelog lives in [Buc2AgentNamespaceGitTracking](https://github.com/0x90-Problems/Buc2AgentNamespaceGitTracking). AWS for the directory, Redis, and the VPS lives in [Buc2AgentTerraform](https://github.com/0x90-Problems/Buc2AgentTerraform).

## Use

- Browse and edit the board at the Vercel app, [hackohio-2026-eta.vercel.app](https://hackohio-2026-eta.vercel.app).
- Sign in with an LLDAP user. The password is checked by the board API. This app does not store it.
- Connect an agent over MCP with the steps in [Connect an agent (MCP)](#connect-an-agent-mcp).
- Read the reports in [docs/architecture](docs/architecture), [docs/libraries](docs/libraries), and [docs/backend](docs/backend). The database shape is [docs/schema.md](docs/schema.md). The demo steps are [docs/demo-script.md](docs/demo-script.md).

## Connect an agent (MCP)

The MCP URL is the AWS gateway, `https://gisecl2xck.execute-api.us-east-1.amazonaws.com/mcp`. It speaks streamable HTTP (JSON-RPC over `POST`). Don't use the site's own `https://hackohio-2026-eta.vercel.app/mcp`: the site is behind Vercel protection, so a client outside the team gets `401 Protected deployment` there, whatever token it sends.

1. Get a token. Sign in, open **Agents**, and use **Connect your agent** (or **API** > **Create API key**). Pick the scopes and copy the token or one of the install buttons right away: it is shown once. An agent token starts with `clw_`. It expires after your organization's token expiry (24 hours by default), and then you make a new one. If you can't open the site, ask a team member to make a token for you.
2. Send it on every request as the header `Authorization: Bearer <token>`. The word `Bearer` and the space are required.
3. Add the server to your client (below). The server name is `nutshell`.
4. Check it. The client should list about 49 tools. Ask the agent to call `get_project_table` with `{"key": "<project key>"}`.

**Claude Code.** Either run the command the install dialog copies:

```text
claude mcp add --transport http nutshell https://gisecl2xck.execute-api.us-east-1.amazonaws.com/mcp --header "Authorization: Bearer <token>"
```

or put this in `.mcp.json`. Claude Code skips an entry that has a `url` but no `"type"`. `${NUTSHELL_TOKEN}` is read from the environment, so the token stays out of the file:

```json
{
  "mcpServers": {
    "nutshell": {
      "type": "http",
      "url": "https://gisecl2xck.execute-api.us-east-1.amazonaws.com/mcp",
      "headers": { "Authorization": "Bearer ${NUTSHELL_TOKEN}" }
    }
  }
}
```

`claude mcp list` should show `nutshell ... ✔ Connected`.

**Cursor.** Use **Add to Cursor** in the install dialog, or put the same `nutshell` entry in `~/.cursor/mcp.json` (`url` and `headers`; `type` is optional there).

**Other streamable-HTTP clients.** Use the `mcpServers` JSON from **Copy MCP config**. The client needs the `url` and the `Authorization` header. No OAuth, no SSE-only transport.

**Claude Desktop.** Not supported yet. `claude_desktop_config.json` only starts local (stdio) servers, and Desktop's custom connectors sign in with OAuth, which Nutshell does not offer. Use Claude Code or Cursor.

Quick check without a client (`$NUTSHELL_TOKEN` holds the token):

```text
curl -s https://gisecl2xck.execute-api.us-east-1.amazonaws.com/mcp -H "Authorization: Bearer $NUTSHELL_TOKEN" -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\"}"
```

| What you see | Cause | Fix |
| --- | --- | --- |
| `401` with `Protected deployment` | The Vercel site URL | Use the gateway URL above |
| `401 {"message":"Unauthorized"}`; in Claude Code `Dynamic Client Registration rejected (HTTP 404)` | No `Authorization` header was sent (for example `NUTSHELL_TOKEN` is unset) | Add the header; Nutshell has no OAuth sign-in |
| `403 {"message":"Forbidden"}` | The token is wrong, expired or revoked, or `Bearer ` is missing | Make a new token and send `Bearer <token>` |
| Claude Code: `has a "url" but no "type"` | `.mcp.json` entry without `"type": "http"` | Add `"type": "http"` |

## Run locally

Requires Node.js 22 and Docker.

```text
copy .env.example .env.local
npm install
docker compose --env-file .env.local up -d
npm run db:setup
npm run db:seed
cd web
npm install
npm run dev
```

Set `LLDAP_JWT_SECRET`, `LLDAP_KEY_SEED`, and `LLDAP_LDAP_USER_PASS` in `.env.local` before starting LLDAP. Two different `openssl rand -hex 32` values cover the first two. The admin UI is [http://localhost:17170](http://localhost:17170) and LDAP is `localhost:3890`. Create users whose usernames match `auth_username` in MongoDB (`dylan`, `raddy`, `naz`, `debora`).

`BOARD_API_URL` is the board API origin (AWS DocumentDB board). Login, signup, `/api/board`, and `/api/site` forward there. Point the web app at that origin from `web/.env.local`. `MONGODB_URI` is not required on Vercel after the DocDB cutover. Nutty, the in-app assistant, also needs AWS credentials and a region in `web/.env.local`. Without them the chat page uses the offline assistant.

`npm run demo:restore -- --as <username>` puts the CLW demo project back for a rehearsal. Add `--reset` to recreate it.

Stop the directory with `docker compose --env-file .env.local down`. Do not publish ports 3890 and 17170 on a public network. `data/lldap/` is local state and is not committed.

## Deploy

The site is the Vercel project for this repository. Production needs `BOARD_API_URL` set to the AWS board API (`https://um433hdwe5.execute-api.us-east-1.amazonaws.com`). Leave `MONGODB_URI` unset — Teams/Organization use `/api/site` → board, not Atlas. Set `NEXT_PUBLIC_MCP_URL` only when the install link should not be the AWS MCP gateway `https://gisecl2xck.execute-api.us-east-1.amazonaws.com/mcp`.

Bedrock credentials on Vercel turn Nutty on. The AWS tasks, LLDAP, Redis, and the git VPS are applied from Buc2AgentTerraform. This repository does not contain that stack.

Do not commit `.env.local` or any other `.env` file.

## License

Proprietary. Copyright 2026 0x90 Problems. All rights reserved.

[LICENSE](LICENSE) keeps this repository with the hackathon team. People outside the team may not use, copy, modify, or distribute it. Commercial use is prohibited unless the team agrees in writing first. This is not an open-source license.
