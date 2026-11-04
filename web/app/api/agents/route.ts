import { proxyBoard } from "@/lib/board-proxy"

export async function GET(request: Request) {
  return proxyBoard(request, "/agents")
}

export async function POST(request: Request) {
  return proxyBoard(request, "/agents")
}

// Bulk cleanup of your inactive agents: only state and dry_run go through.
export async function DELETE(request: Request) {
  const incoming = new URL(request.url).searchParams
  const query = new URLSearchParams()
  for (const name of ["state", "dry_run"]) {
    const value = incoming.get(name)
    if (value !== null) query.set(name, value)
  }
  const search = query.toString()
  return proxyBoard(request, search ? `/agents?${search}` : "/agents")
}
