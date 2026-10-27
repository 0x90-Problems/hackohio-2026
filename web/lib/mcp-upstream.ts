// Chooses where /mcp is forwarded during the AWS strangler rollout.
// Default: existing board API (Vercel). Shadow: AWS HTTP API when enabled.

export type McpRouteMode = "off" | "test" | "all"

const AWS_MCP_GATEWAY_FALLBACK = "https://gisecl2xck.execute-api.us-east-1.amazonaws.com"

export function mcpRouteMode(): McpRouteMode {
  const raw = process.env.MCP_ROUTE_TO_AWS?.trim().toLowerCase()
  if (raw === "test" || raw === "all") return raw
  // Default to shadow test mode so header opt-in works without a Vercel env change.
  return "test"
}

export function awsMcpGatewayOrigin(): URL | null {
  const candidates = [process.env.AWS_MCP_GATEWAY_URL?.trim(), AWS_MCP_GATEWAY_FALLBACK]
  for (const raw of candidates) {
    if (!raw) continue
    try {
      const url = new URL(raw)
      if (url.protocol !== "https:") continue
      return url
    } catch {
      // try next
    }
  }
  return null
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
