import { proxyBoard } from "@/lib/board-proxy"
import { awsMcpGatewayOrigin, shouldUseAwsGateway } from "@/lib/mcp-upstream"

async function proxyMcp(request: Request): Promise<Response> {
  if (shouldUseAwsGateway(request)) {
    const gateway = awsMcpGatewayOrigin()
    if (gateway) return proxyBoard(request, "/mcp", gateway)
  }
  return proxyBoard(request, "/mcp")
}

export async function GET(request: Request) {
  return proxyMcp(request)
}

export async function POST(request: Request) {
  return proxyMcp(request)
}
