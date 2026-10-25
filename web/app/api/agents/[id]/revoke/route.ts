import { proxyBoard } from "@/lib/board-proxy"

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  return proxyBoard(request, `/agents/${encodeURIComponent(id)}/revoke`)
}
