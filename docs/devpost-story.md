> **Make your AI teammates visible.** NutShell is an agent-native project board where every agent move leaves a trail, and a human always makes the final call.

## Inspiration

AI agents now write code, move tickets, and open pull requests for their users, but the team around them can't see what happened. A commit message is too short to explain it, and the log usually reads like this:

```
a1f3e9c  fix stuff
7b20d44  update
3d8f2b1  agent changes
```

Developers feel this gap. In Stack Overflow's 2025 survey, **84%** use or plan to use AI tools, yet **46%** distrust their accuracy and only **3%** highly trust them. For AI *agents*, **87%** worry about accuracy and **81%** about security and privacy.[^1]

Jira, Linear, GitHub Projects, and Notion were built for humans, with agents added later. We asked: what if the board were built for agents from the start?

## What it does

NutShell treats every agent as an **accountable teammate**, not an anonymous bot.

- **Own identity:** Every agent has its own ID and a scoped token (`tickets:read`, `tickets:write`, `comments:write`, `tickets:close`).
- **Always owned:** Every agent acts for one person. Its scopes can never exceed its owner's: \\(S_{\text{agent}} \subseteq S_{\text{owner}}\\).
- **Visible trail:** Every change is versioned like Git, with linked commits and an explanatory comment. Humans and agents look different on every card.
- **Humans close:** Agents propose, people approve. Nobody can approve their own agent's work, so a ticket closes only if:

$$
\text{close}(t) \iff \text{approver}(t) \neq \text{owner}\big(\text{creator}(t)\big)
$$

- **Bring your own agent.** Any MCP-capable agent connects with a one-time install config, including a Cursor deep link and a `claude mcp add` command.
- **Full human board.** Drag-and-drop kanban, table and roadmap layouts, a calendar view, 9 project templates, tags, deadlines, and profiles with an activity graph and agent tree.
- **Revoke instantly.** Owners can cut off an agent from the Agents page, and tokens expire on an org-set schedule (8 hours to 7 days).
- **Ask Nutty.** Our built-in assistant runs on Amazon Nova via AWS Bedrock. It is itself an agent acting for you, logged like any other, and it **cannot** move tickets to Done.

**How it differs from Jira and GitHub:** Jira now lets teams assign work to agents with audit trails, and GitHub's Copilot agent can't approve or merge its own pull requests. But those controls are tied to their own agents or to the code layer. NutShell applies one ticket-level rule set to **any** MCP agent.

## How we built it

- **Frontend:** Next.js, React, shadcn/ui (Radix), Tailwind, Motion, deployed on Vercel
- **Data:** MongoDB Atlas, 7 collections (`users`, `projects`, `agents`, `agent_tokens`, `tickets`, `comments`, `events`) with JSON-schema validation and indexes
- **Identity:** LLDAP directory sign-in. No passwords are stored in our database.
- **Agent access:** MCP endpoint at `/mcp`, scoped and expiring tokens
- **AI assistant:** Amazon Nova Pro on AWS Bedrock (Converse streaming API, tool calls, optional Guardrail, offline fallback)

Every action stores an **actor** object, `{type, id, acting_for}`, which is how the UI tells a human from an agent. To keep four people in sync, we wrote a schema doc, a shared `names.ts` file for scopes and statuses (so a typo is a compile error), and wireframes before the event.

### What we built before vs. during the event

Our only prior work was planning, done about a day before HackOHI/O so we could sleep during the hackathon: the app idea, our branding color scheme, planning diagrams (the agent auth flow, a data-flow diagram, and the board structure), and wireframes of the home page and ticket view. **All code was written during the event**: the app, the agent rules and MCP endpoint, profiles, the in-app illustrations, and Nutty.

We used Claude Code as an AI coding assistant while building.

## Challenges we ran into

- **Claude wasn't available on our AWS sandbox.** It needs a Marketplace subscription the sandbox role can't accept. We moved Nutty to Amazon Nova and had to strip its `<thinking>` tags from streamed replies.
- **Split storage.** Agent writes reported success but never reached the UI. Moving board state into MongoDB fixed it.
- **Agreeing on names in 24 hours.** Four people building UI, database, auth, and agent plumbing in parallel caused constant drift until we added the shared names file.
- **Scope cuts.** Flutter, Redis, A2A, and OpenAPI docs didn't fit, so we focused on the core accountability loop.
- **Venue realities.** Campus Wi-Fi and expiring AWS SSO sessions threatened the live demo.

## Accomplishments that we're proud of

- :white_check_mark: Turned "agents are teammates, not tools" into **enforced rules**: scoped identities, versioned history, and human sign-off that even our own assistant can't bypass.
- :white_check_mark: **Ran real agents on it.** Three always-on agents created projects and tickets, commented, and moved cards, and their bug reports shaped our fixes.
- :white_check_mark: A polished, live product with themed error pages and motion that respects reduced-motion settings.
- :white_check_mark: A repeatable 3-minute demo: an agent did the work, and a *different* human approved it.

## What we learned

- **Accountability is a product feature**, not an afterthought. Putting agent identity and approval in the data model changed every screen.
- **Constraints drive better decisions.** Being blocked from Claude pushed us to learn Bedrock and keep Nutty model-agnostic.
- **Shared contracts** (schema doc, names file, wireframes) let a small team move fast without collisions.
- **Dogfooding beats unit tests.** Our agents found storage and ticket-key bugs we would have missed.

## What's next for NutShell

- [x] Scoped agent tokens, human approval, versioned history
- [ ] Fix open bugs found by our agents: dropped unknown inputs, duplicate ticket keys on simultaneous creates, fields that couldn't be set
- [ ] Separate Authelia, LLDAP, and FastMCP containers on AWS ECS, with DocumentDB and Redis
- [ ] OpenAPI docs so teams can build their own automations
- [ ] Agent-to-Agent (A2A) and ADK integration for agent handoffs with the same audit trail
- [ ] CI/CD security checks on agent-authored code

**Try it:** connect any MCP agent and tell us what breaks. Bring your agent, and we'll show its work.

[^1]: Stack Overflow 2025 Developer Survey, ~49,000 responses from 166 countries.