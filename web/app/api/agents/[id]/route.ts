import { proxyBoard } from "@/lib/board-proxy"

// Deletes one agent or API key for good (owner or org admin).
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  return proxyBoard(request, `/agents/${encodeURIComponent(id)}`)
}
