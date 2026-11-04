import { filesOrigin } from "@/lib/board-proxy"
import { handleFileView } from "@/lib/file-view"

export const dynamic = "force-dynamic"
export const revalidate = 0

// Where the files API's signed links point. The route only ever redirects to these hosts.
const BUCKET_HOSTS = (
  process.env.FILES_BUCKET_HOSTS ??
  "nutshell-prod-files-883501587155.s3.amazonaws.com,nutshell-prod-files-883501587155.s3.us-east-1.amazonaws.com"
)
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean)

// Opens a file for someone signed in: checks their session (the /api/files cookie) and, through
// the files API, that they're on the team and may read this file; then 302s to a 60-second link.
export async function GET(request: Request, ctx: RouteContext<"/api/files/[id]/view">) {
  const { id } = await ctx.params
  const forwarded = request.headers.get("x-forwarded-for")
  return handleFileView(request, id, {
    bucketHosts: BUCKET_HOSTS,
    secure: new URL(request.url).protocol === "https:",
    fetchLink: (path, bearer, team) => {
      const headers: Record<string, string> = { accept: "application/json", authorization: `Bearer ${bearer}` }
      if (team) headers["x-nutshell-team"] = encodeURIComponent(team)
      if (forwarded) headers["x-forwarded-for"] = forwarded
      return fetch(new URL(path, filesOrigin()), { headers, cache: "no-store", redirect: "manual" })
    },
  })
}
