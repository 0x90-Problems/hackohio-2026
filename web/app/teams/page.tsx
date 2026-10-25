import type { Metadata } from "next"

import { TeamsView } from "@/components/teams/teams-view"

export const metadata: Metadata = {
  title: "Teams · NutShell",
}

export default function TeamsPage() {
  return <TeamsView />
}
