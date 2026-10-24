import type { Metadata } from "next"

import { ApiView } from "@/components/api/api-view"

export const metadata: Metadata = {
  title: "API · buck2agents",
}

export default function ApiPage() {
  return <ApiView />
}
