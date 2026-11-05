import type { Metadata } from "next"

import { OrganizationView } from "@/components/organization/organization-view"
import { OrgAdminView } from "@/components/org/org-admin-view"
import { multiOrgOn } from "@/lib/org-choice"
import { pageTitle } from "@/lib/brand"

export const metadata: Metadata = {
  title: pageTitle("Organization"),
}

export default function OrganizationPage() {
  // Several orgs: this org's members and invites. Flag off: today's page.
  return multiOrgOn() ? <OrgAdminView /> : <OrganizationView />
}
