// One-time MCP install payload. The API page builds this from the secret
// makeToken() just created. A saved key is only a prefix, so this cannot be
// rebuilt later. NEXT_PUBLIC_MCP_URL overrides the live server address.

export const MCP_SERVER_NAME = "buc2agents"

export const DEFAULT_MCP_URL = "http://44.213.112.76:8080/mcp"

export function mcpPublicUrl() {
  const configured = process.env.NEXT_PUBLIC_MCP_URL?.trim()
  return configured || DEFAULT_MCP_URL
}

type McpServer = {
  url: string
  headers: { Authorization: string }
}

export function mcpInstall(secret: string) {
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
