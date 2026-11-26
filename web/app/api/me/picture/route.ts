import { proxyBoard } from "@/lib/board-proxy"

// Your own profile picture (NSB-97): the board checks the picture and that it's you.
export async function PUT(request: Request) {
  return proxyBoard(request, "/me/picture")
}

export async function DELETE(request: Request) {
  return proxyBoard(request, "/me/picture")
}
