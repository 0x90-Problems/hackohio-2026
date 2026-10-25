import type { Metadata } from "next"

import { ApiView } from "@/components/api/api-view"
import { pageTitle } from "@/lib/brand"

export const metadata: Metadata = {
  title: pageTitle("API"),
}

export default function ApiPage() {
  return <ApiView />
}
