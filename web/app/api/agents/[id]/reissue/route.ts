import { proxyBoard } from "@/lib/board-proxy"

// A new token for the same agent or API key; { reset: true } stops every old one first.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  return proxyBoard(request, `/agents/${encodeURIComponent(id)}/reissue`)
}
