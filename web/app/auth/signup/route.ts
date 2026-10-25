import { proxyAuth } from "@/lib/auth-upstream"

export async function POST(request: Request) {
  return proxyAuth(request, "/auth/signup")
}
