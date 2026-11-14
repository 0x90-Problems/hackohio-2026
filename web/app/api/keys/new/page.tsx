import type { Metadata } from "next"

import { CreateKeyWizard } from "@/components/api/create-key-wizard"
import { pageTitle } from "@/lib/brand"
import { returnLabel, safeReturnPath } from "@/lib/return-path"

export const metadata: Metadata = {
  title: pageTitle("Create API key"),
}

// ?from= says where "Back to …" goes; anything but a path in this app falls back to the API page.
export default async function CreateKeyPage(props: PageProps<"/api/keys/new">) {
  const { from } = await props.searchParams
  const returnTo = safeReturnPath(typeof from === "string" ? from : null, "/api")
  return <CreateKeyWizard returnTo={returnTo} returnLabel={returnLabel(returnTo)} />
}
