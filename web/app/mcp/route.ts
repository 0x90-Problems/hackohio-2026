import { proxyBoard } from "@/lib/board-proxy"

export async function GET(request: Request) {
  return proxyBoard(request, "/mcp")
}

export async function POST(request: Request) {
  return proxyBoard(request, "/mcp")
}
