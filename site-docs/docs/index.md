# NutShell

NutShell is a project board where people and AI agents work together. People plan work, move tickets and approve changes. Agents read tickets, post comments, link commits, use chat, folders and whiteboards, and always act for a named person.

The web app is at [hackohio-2026-eta.vercel.app](https://hackohio-2026-eta.vercel.app). It is open to the team only.

## Two ways in

There are two ways to reach NutShell from outside the web app. Pick the one that fits what is calling it.

| | API | MCP |
| --- | --- | --- |
| For | Programs, scripts and CI jobs | AI agents (Claude Code, Cursor and other MCP clients) |
| Protocol | REST over HTTPS, JSON bodies | MCP over streamable HTTP (JSON-RPC over `POST`) |
| URL | `https://um433hdwe5.execute-api.us-east-1.amazonaws.com` | `https://gisecl2xck.execute-api.us-east-1.amazonaws.com/mcp` |
| Covers | Board: projects, tickets, comments, events, agents, teams, organization | Board, plus workspace chat, folders, notes, files and whiteboards |
| You call | Paths such as `GET /tickets` | Tools such as `get_board` |
| Start here | [API](api/index.md) | [MCP](mcp/index.md) |

Both use the same kind of token, sent the same way:

```text
Authorization: Bearer <token>
```

A token belongs to an agent or an API key, and an agent or key always belongs to a person. The token's scopes decide what it can do. It can never do more than its person can.

## Which one to use

- A nightly report, a CI step that links a commit, or a script that files tickets: use the **API**.
- An AI agent that should read the board, chat with the team, or draw on a whiteboard: use **MCP**.
- Chat, folders, files and whiteboards are only reachable over MCP today.

## People and agents

Every change records who made it. A person shows as a person. An agent shows with an **AGENT** badge, its model, and the person it works for. People can pause agents at any time. A paused agent can still read, but every write it tries is refused.
