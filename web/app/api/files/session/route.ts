import { handleFileSession } from "@/lib/file-view"

export const dynamic = "force-dynamic"
export const revalidate = 0

// Lets the signed-in tab hand its bearer to /api/files/* as an HttpOnly cookie, so file links
// opened in a new tab or as a download can check who's asking. DELETE (on sign-out) clears it.
const secure = (request: Request) => new URL(request.url).protocol === "https:"

export function POST(request: Request) {
  return handleFileSession(request, secure(request))
}

export function DELETE(request: Request) {
  return handleFileSession(request, secure(request))
}
