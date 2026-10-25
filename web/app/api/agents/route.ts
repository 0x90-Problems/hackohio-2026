import { proxyBoard } from "@/lib/board-proxy"

export async function GET(request: Request) {
  return proxyBoard(request, "/agents")
}

export async function POST(request: Request) {
  return proxyBoard(request, "/agents")
}
