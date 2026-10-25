import type { Metadata } from "next"

import { TeamsView } from "@/components/teams/teams-view"
import { pageTitle } from "@/lib/brand"

export const metadata: Metadata = {
  title: pageTitle("Teams"),
}

export default function TeamsPage() {
  return <TeamsView />
}
