import type { Metadata } from "next"

import { TeamsView } from "@/components/teams/teams-view"

export const metadata: Metadata = {
  title: "Teams · buck2agents",
}

export default function TeamsPage() {
  return <TeamsView />
}
