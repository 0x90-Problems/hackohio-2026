// One-time MCP install payload. The board issues this with a stored secret.
// A saved key is only a prefix, so this cannot be rebuilt later.
// NEXT_PUBLIC_MCP_URL overrides the live server address.

export const MCP_SERVER_NAME = "nutshell"

export const DEFAULT_MCP_URL = "https://hackohio-2026-eta.vercel.app/mcp"

export function mcpPublicUrl() {
  const configured = process.env.NEXT_PUBLIC_MCP_URL?.trim()
  return configured || DEFAULT_MCP_URL
}

type McpServer = {
  url: string
  headers: { Authorization: string }
}

export type McpInstallLinks = {
  json: string
  cursorUrl: string
  claudeCommand: string
}

export function mcpLinksFromApi(mcp: {
  json: string
  cursor_url: string
  claude_command: string
}): McpInstallLinks {
  return {
    json: mcp.json,
    cursorUrl: mcp.cursor_url,
    claudeCommand: mcp.claude_command,
  }
}

export function mcpInstall(secret: string): McpInstallLinks {
  const url = mcpPublicUrl()
  const server: McpServer = {
    url,
    headers: { Authorization: `Bearer ${secret}` },
  }
  const json = JSON.stringify(
    { mcpServers: { [MCP_SERVER_NAME]: server } },
    null,
    2
  )
  const config = base64Url(JSON.stringify(server))
  return {
    json,
    cursorUrl: `cursor://anysphere.cursor-deeplink/mcp/install?name=${MCP_SERVER_NAME}&config=${config}`,
    claudeCommand: `claude mcp add --transport http ${MCP_SERVER_NAME} ${url} --header "Authorization: Bearer ${secret}"`,
  }
}

function base64Url(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}
