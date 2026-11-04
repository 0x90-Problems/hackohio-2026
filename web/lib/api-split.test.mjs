import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { AGENT_CONNECTION, ALL_SCOPES, MCP_TOOLS } from "../../shared/names.ts"
import { DEFAULT_BOARD_API_URL, boardApiPublicUrl, curlExample, onlyConnection } from "./rest-api.ts"
import { groupTools, toolArea } from "./mcp-tools.ts"
import { parseTools, requiredScopes, summary } from "../scripts/sync-mcp-tools.mjs"

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8")
const catalog = JSON.parse(read("../../shared/mcp-tools.json"))
const toolNames = Object.values(MCP_TOOLS)

test("every tool in MCP_TOOLS has a description from the backend", () => {
  const described = new Map(catalog.tools.map((tool) => [tool.name, tool.description]))
  const missing = toolNames.filter((name) => !described.get(name)?.trim())
  assert.deepEqual(missing, [], `MCP_TOOLS without a description: ${missing.join(", ")}. Run web/scripts/sync-mcp-tools.mjs`)
})

test("mcp-tools.json names no tool that MCP_TOOLS or names.json lacks", () => {
  const extra = catalog.tools.map((tool) => tool.name).filter((name) => !toolNames.includes(name))
  assert.deepEqual(extra, [])
  assert.deepEqual([...JSON.parse(read("../../shared/names.json")).mcp_tools].sort(), [...toolNames].sort())
})

test("tool descriptions are one line and name only real scopes", () => {
  for (const tool of catalog.tools) {
    assert.ok(!tool.description.includes("\n"), tool.name)
    for (const scope of tool.scopes) assert.ok(ALL_SCOPES.includes(scope), `${tool.name}: ${scope}`)
  }
})

test("every tool lands in an area, and board chat tools hide until board chat is on", () => {
  assert.equal(toolArea(MCP_TOOLS.WB_APPLY_OPS), "whiteboard")
  assert.equal(toolArea(MCP_TOOLS.CHAT_POST), "chat")
  assert.equal(toolArea(MCP_TOOLS.POST_MESSAGE, catalog.board_chat_tools), "chat")
  assert.equal(toolArea(MCP_TOOLS.UPDATE_NOTE), "documents")
  assert.equal(toolArea(MCP_TOOLS.PAUSE_AGENTS), "agents")
  assert.equal(toolArea(MCP_TOOLS.GET_PROJECT_TABLE), "projects")
  assert.equal(toolArea(MCP_TOOLS.LIST_TICKET_FILES), "files")
  assert.equal(toolArea(MCP_TOOLS.REQUEST_UPLOAD), "files")
  assert.equal(toolArea(MCP_TOOLS.MOVE_TICKET), "board")

  const all = groupTools(catalog, true).flatMap((area) => area.tools)
  assert.equal(all.length, catalog.tools.length)
  const live = groupTools(catalog).flatMap((area) => area.tools.map((tool) => tool.name))
  assert.equal(live.length, catalog.tools.length - catalog.board_chat_tools.length)
  assert.ok(!live.includes(MCP_TOOLS.POST_MESSAGE))
})

test("sync script keeps the first sentence and the Requires scopes", () => {
  const source = `const TOOLS = [
  { name: "wb_view_region", description: "See part of a board. Requires whiteboard:read, whiteboard:view and folders:read.", inputSchema: {} },
  { name: "pause_agents", description: "Human-only: pause one agent (agent_id) or every agent on the board. Saved with the board.", inputSchema: {} },
];
const BOARD_CHAT_TOOLS = new Set(["post_message"]);`
  const { tools, boardChat } = parseTools(source)
  assert.deepEqual(tools, [
    { name: "wb_view_region", description: "See part of a board.", scopes: ["whiteboard:read", "whiteboard:view", "folders:read"] },
    { name: "pause_agents", description: "Human-only: pause one agent (agent_id) or every agent on the board.", scopes: [] },
  ])
  assert.deepEqual(boardChat, ["post_message"])
  assert.equal(summary("No full stop"), "No full stop")
  assert.deepEqual(requiredScopes("Requires chat:read; 60 per minute."), ["chat:read"])
})

test("the API page shows the public board REST API", () => {
  assert.equal(boardApiPublicUrl(undefined), DEFAULT_BOARD_API_URL)
  assert.equal(boardApiPublicUrl("  "), DEFAULT_BOARD_API_URL)
  assert.equal(boardApiPublicUrl("not a url"), DEFAULT_BOARD_API_URL)
  assert.equal(boardApiPublicUrl("ftp://example.com"), DEFAULT_BOARD_API_URL)
  assert.equal(boardApiPublicUrl("https://board.example.com/"), "https://board.example.com")
  assert.equal(
    curlExample("https://board.example.com"),
    'curl -s https://board.example.com/tickets -H "Authorization: Bearer $NUTSHELL_API_KEY"',
  )
})

test("API keys and MCP agents each list only their own connection type", () => {
  const rows = [
    { _id: "a", connection: AGENT_CONNECTION.MCP },
    { _id: "b", connection: AGENT_CONNECTION.API_KEY },
    { _id: "c" },
  ]
  const ids = (list) => list.map((row) => row._id)
  assert.deepEqual(ids(onlyConnection(rows, AGENT_CONNECTION.MCP, AGENT_CONNECTION.MCP)), ["a", "c"])
  assert.deepEqual(ids(onlyConnection(rows, AGENT_CONNECTION.API_KEY, AGENT_CONNECTION.MCP)), ["b"])
})

test("the API page has no MCP install config, and the Agents page owns the tool list", () => {
  const api = read("../components/api/api-view.tsx")
  for (const banned of ["MCP_TOOLS", "mcp-install", "mcpPublicUrl", "McpInstall", "Cursor", "claude mcp add", "TOOL_DESCRIPTIONS"]) {
    assert.ok(!api.includes(banned), `api-view.tsx still mentions ${banned}`)
  }
  assert.ok(api.includes('href="/agents"'), "API page links to Agents (MCP)")
  const agents = read("../components/agents/agents-view.tsx")
  assert.ok(agents.includes("mcp-tools.json"), "Agents page lists the MCP tools")
  assert.ok(agents.includes("mcpPublicUrl"), "Agents page shows the MCP gateway URL")
})
