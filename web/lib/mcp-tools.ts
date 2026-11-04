// The MCP tools the gateway serves, grouped by area for the Agents page.
// Descriptions come from shared/mcp-tools.json, which web/scripts/sync-mcp-tools.mjs
// copies from the backend's tool list. Pure so it can be unit tested.

export type McpToolInfo = { name: string; description: string; scopes: string[] }

export type McpToolCatalog = {
  board_chat_tools: string[]
  tools: McpToolInfo[]
}

export const MCP_AREAS = [
  { id: "board", label: "Board" },
  { id: "projects", label: "Projects" },
  { id: "files", label: "Files & folders" },
  { id: "documents", label: "Documents" },
  { id: "chat", label: "Chat" },
  { id: "whiteboard", label: "Whiteboard" },
  { id: "agents", label: "Agents" },
] as const

export type McpArea = (typeof MCP_AREAS)[number]["id"]

/** Which area a tool belongs to, read from its name. */
export function toolArea(name: string, boardChat: readonly string[] = []): McpArea {
  if (name.startsWith("wb_")) return "whiteboard"
  if (name.startsWith("chat_") || boardChat.includes(name)) return "chat"
  if (name.endsWith("_note")) return "documents"
  if (name.endsWith("_agents")) return "agents"
  if (name.includes("project")) return "projects"
  if (/folder|file|upload|version/.test(name)) return "files"
  return "board"
}

/**
 * The tools a client sees from tools/list, grouped by area in MCP_AREAS order.
 * Board chat tools are left out unless board chat is on, as the gateway does.
 */
export function groupTools(catalog: McpToolCatalog, boardChatOn = false) {
  const visible = catalog.tools.filter((tool) => boardChatOn || !catalog.board_chat_tools.includes(tool.name))
  return MCP_AREAS.map((area) => ({
    ...area,
    tools: visible.filter((tool) => toolArea(tool.name, catalog.board_chat_tools) === area.id),
  })).filter((area) => area.tools.length > 0)
}
