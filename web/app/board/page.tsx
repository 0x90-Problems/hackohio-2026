import { redirect } from "next/navigation"

import { DEFAULT_PROJECT_KEY } from "@/lib/mock-data"

// Old address: /board now lives at /projects/<key>/board
export default function BoardPage() {
  redirect(`/projects/${DEFAULT_PROJECT_KEY}/board`)
}
