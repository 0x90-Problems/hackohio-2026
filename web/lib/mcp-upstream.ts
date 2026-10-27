// Chooses where /mcp is forwarded during the AWS strangler rollout.
// Default: existing board API (Vercel). Shadow: AWS HTTP API when enabled.

export type McpRouteMode = "off" | "test" | "all"

export function mcpRouteMode(): McpRouteMode {
  const raw = process.env.MCP_ROUTE_TO_AWS?.trim().toLowerCase()
  if (raw === "test" || raw === "all") return raw
  return "off"
}

export function awsMcpGatewayOrigin(): URL | null {
  const raw = process.env.AWS_MCP_GATEWAY_URL?.trim()
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== "https:") return null
    return url
  } catch {
    return null
  }
}

/** Test agents opt in with header x-nutshell-mcp-path: aws */
export function shouldUseAwsGateway(request: Request): boolean {
  const mode = mcpRouteMode()
  if (mode === "off") return false
  const gateway = awsMcpGatewayOrigin()
  if (!gateway) return false
  if (mode === "all") return true
  return request.headers.get("x-nutshell-mcp-path")?.trim().toLowerCase() === "aws"
}
