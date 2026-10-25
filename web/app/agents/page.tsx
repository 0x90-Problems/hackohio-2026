import type { Metadata } from "next"

import { AgentsView } from "@/components/agents/agents-view"
import { pageTitle } from "@/lib/brand"

export const metadata: Metadata = {
  title: pageTitle("Agents"),
}

export default function AgentsPage() {
  return <AgentsView />
}
