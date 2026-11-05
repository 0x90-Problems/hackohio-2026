import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ORG_TEXT } from "@/shared/names"
import { AcceptInvite } from "@/components/org/accept-invite"
import { pageTitle } from "@/lib/brand"
import { multiOrgOn } from "@/lib/org-choice"

export const metadata: Metadata = {
  title: pageTitle(ORG_TEXT.ACCEPT_TITLE),
  // The token travels in the fragment, but never hand this page's address on as a referrer.
  referrer: "no-referrer",
}

export default function InvitePage() {
  if (!multiOrgOn()) notFound()
  return <AcceptInvite />
}
