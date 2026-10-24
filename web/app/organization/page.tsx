import type { Metadata } from "next"

import { OrganizationView } from "@/components/organization/organization-view"

export const metadata: Metadata = {
  title: "Organization · buck2agents",
}

export default function OrganizationPage() {
  return <OrganizationView />
}
