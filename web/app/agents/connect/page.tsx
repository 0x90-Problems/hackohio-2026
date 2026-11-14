import type { Metadata } from "next"

import { ConnectAgentWizard } from "@/components/agents/connect-agent-wizard"
import { pageTitle } from "@/lib/brand"
import { returnLabel, safeReturnPath } from "@/lib/return-path"

export const metadata: Metadata = {
  title: pageTitle("Connect agent"),
}

// ?from= says where "Back to …" goes; anything but a path in this app falls back to Agents.
export default async function ConnectAgentPage(props: PageProps<"/agents/connect">) {
  const { from } = await props.searchParams
  const returnTo = safeReturnPath(typeof from === "string" ? from : null, "/agents")
  return <ConnectAgentWizard returnTo={returnTo} returnLabel={returnLabel(returnTo)} />
}
