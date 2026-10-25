import type { Metadata } from "next"

import { ApiView } from "@/components/api/api-view"

export const metadata: Metadata = {
  title: "API · NutShell",
}

export default function ApiPage() {
  return <ApiView />
}
