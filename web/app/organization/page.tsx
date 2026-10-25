import type { Metadata } from "next"

import { OrganizationView } from "@/components/organization/organization-view"
import { pageTitle } from "@/lib/brand"

export const metadata: Metadata = {
  title: pageTitle("Organization"),
}

export default function OrganizationPage() {
  return <OrganizationView />
}
