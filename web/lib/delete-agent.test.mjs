import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { AGENT_CONNECTION, EVENT_ACTIONS } from "../../shared/names.ts"
import { authorAgentName, visibleAgentName } from "./agent-label.ts"
import {
  canDeleteAgent,
  cleanupCount,
  deleteSummary,
  deletedEventText,
  parseCleanup,
  parseDeletedAgent,
  splitCleanup,
} from "./delete-agent.ts"

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8")
const row = (agent_id, connection, name = agent_id) => ({ agent_id, name, owner_id: "user_dylan", connection, tokens: 1 })
const agentWords = { one: "agent", many: "agents", otherOne: "API key", otherMany: "API keys" }

test("agent_deleted is a shared event action, in names.ts and names.json", () => {
  assert.equal(EVENT_ACTIONS.AGENT_DELETED, "agent_deleted")
  assert.deepEqual([...JSON.parse(read("../../shared/names.json")).event_actions].sort(), Object.values(EVENT_ACTIONS).sort())
})

test("only the owner or an org admin is offered Delete", () => {
  assert.equal(canDeleteAgent("user_a", "user_a", false), true)
  assert.equal(canDeleteAgent("user_a", "user_b", true), true)
  assert.equal(canDeleteAgent("user_a", "user_b", false), false)
  assert.equal(canDeleteAgent("user_a", undefined, true), false)
})

test("the confirm text names it, says its tokens stop working, and that history stays", () => {
  const agent = deleteSummary("Claude Code", "agent")
  assert.match(agent, /^Claude Code's tokens stop working right away\./)
  assert.match(agent, /past comments and tickets stay/)
  const key = deleteSummary("Nightly script", "key")
  assert.match(key, /^Nightly script stops working right away: requests with it get 401\./)
  assert.match(key, /comments it made stay/)
})

test("a DELETE /agents/:id answer parses, and junk doesn't", () => {
  assert.deepEqual(parseDeletedAgent({ agent_id: "agent_ab12", name: "Bot", owner_id: "user_d", connection: "api_key", tokens: 2 }), {
    agent_id: "agent_ab12",
    name: "Bot",
    owner_id: "user_d",
    connection: "api_key",
    tokens: 2,
  })
  assert.equal(parseDeletedAgent({ name: "no id" }), null)
  assert.equal(parseDeletedAgent(null), null)
})

test("a cleanup answer parses, counting only well-formed rows", () => {
  const parsed = parseCleanup({ dry_run: true, count: 3, agents: [row("a1", "mcp"), { bad: true }, row("a2", "api_key")] })
  assert.equal(parsed.dry_run, true)
  assert.equal(parsed.count, 2)
  assert.deepEqual(parsed.agents.map((agent) => agent.agent_id), ["a1", "a2"])
  assert.equal(parseCleanup({ count: 1, agents: [] }), null)
  assert.equal(parseCleanup({ dry_run: false }), null)
})

test("the cleanup list splits by this page's connection; no connection counts as MCP", () => {
  const agents = [row("a1", AGENT_CONNECTION.MCP), row("a2", ""), row("k1", AGENT_CONNECTION.API_KEY)]
  const onAgents = splitCleanup(agents, AGENT_CONNECTION.MCP, AGENT_CONNECTION.MCP)
  assert.deepEqual(onAgents.here.map((a) => a.agent_id), ["a1", "a2"])
  assert.deepEqual(onAgents.elsewhere.map((a) => a.agent_id), ["k1"])
  const onApi = splitCleanup(agents, AGENT_CONNECTION.API_KEY, AGENT_CONNECTION.MCP)
  assert.deepEqual(onApi.here.map((a) => a.agent_id), ["k1"])
  assert.equal(onApi.elsewhere.length, 2)
})

test("the cleanup count names the other kind only when some go too", () => {
  assert.equal(cleanupCount(2, 0, agentWords), "2 agents")
  assert.equal(cleanupCount(1, 1, agentWords), "1 agent and 1 API key")
  assert.equal(cleanupCount(0, 3, agentWords), "3 API keys")
})

test("the activity log says what was deleted", () => {
  assert.equal(deletedEventText({ name: "Cleanup bot", connection: "api_key" }, AGENT_CONNECTION.API_KEY), "Deleted API key Cleanup bot")
  assert.equal(deletedEventText({ name: "Claude Code", connection: "mcp" }, AGENT_CONNECTION.API_KEY), "Deleted agent Claude Code")
  assert.equal(deletedEventText({}, AGENT_CONNECTION.API_KEY), "Deleted an agent")
  assert.equal(deletedEventText({ connection: "api_key" }, AGENT_CONNECTION.API_KEY), "Deleted an API key")
})

test("an author that's gone with no stored name reads Deleted agent", () => {
  const id = "agent_0123456789abcdef0123456789abcdef"
  // The stored name wins, so history keeps a deleted agent's name.
  assert.equal(authorAgentName("Claude Code", id, undefined, false), "Claude Code")
  assert.equal(authorAgentName("", id, "Live name", true), "Live name")
  assert.equal(authorAgentName("", id, undefined, false), "Deleted agent")
  // A stored name that's only the generated id isn't a name.
  assert.equal(authorAgentName(id, id, undefined, false), "Deleted agent")
  // While the directory loads, nothing flashes Deleted agent.
  assert.equal(authorAgentName("", id, undefined, undefined), "Agent")
  // Listed but unnamed stays the plain fallback.
  assert.equal(authorAgentName("", id, "", true), "Agent")
  assert.equal(visibleAgentName("", id), "Agent")
})
