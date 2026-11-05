"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"

import { ORG_TEXT } from "@/shared/names"
import { Building2Icon, MailIcon } from "@/components/icons"
import { absoluteTime } from "@/lib/format"
import { multiOrgOn } from "@/lib/org-choice"
import type { MyInvite } from "@/lib/org-api"
import { orgApi, useOrgs } from "@/lib/use-orgs"
import { CreateOrgForm } from "@/components/org/create-org"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

// Pages someone in no org can still open: their profile, and the invite they're accepting.
const OPEN_WITHOUT_ORG = ["/invite", "/profile", "/login", "/signup"]

/**
 * NEXT_PUBLIC_MULTI_ORG only: someone signed in but in no organization sees onboarding instead
 * of the page. While their orgs load, or if the board can't say, the page shows as usual (it has
 * nothing of anyone else's to show them). Flag off: the children, untouched.
 */
export function OrgGate({ children }: { children: React.ReactNode }) {
  return multiOrgOn() ? <Gate>{children}</Gate> : children
}

function Gate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const open = OPEN_WITHOUT_ORG.includes(pathname)
  const state = useOrgs(!open)
  if (open || state.status !== "ready" || state.orgs.length > 0) return children
  return <OrgOnboarding />
}

type Invites = { status: "loading" } | { status: "ready"; invites: MyInvite[] } | { status: "unavailable" }

export function OrgOnboarding() {
  const [invites, setInvites] = useState<Invites>({ status: "loading" })

  useEffect(() => {
    let cancelled = false
    orgApi.myInvites().then(
      (rows) => !cancelled && setInvites({ status: "ready", invites: rows }),
      // The board can't say (invites not set up yet): just wait for the link.
      () => !cancelled && setInvites({ status: "unavailable" })
    )
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="mx-auto flex max-w-screen-md flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-1 duration-300 animate-in fade-in motion-reduce:animate-none">
        <h1 className="text-3xl font-semibold tracking-tight">{ORG_TEXT.ONBOARD_TITLE}</h1>
        <p className="text-sm text-muted-foreground">{ORG_TEXT.ONBOARD_HINT}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="duration-300 animate-in fade-in slide-in-from-top-2 motion-reduce:animate-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2Icon className="size-5" aria-hidden="true" />
              {ORG_TEXT.CREATE_TITLE}
            </CardTitle>
            <CardDescription>{ORG_TEXT.CREATE_HINT}</CardDescription>
          </CardHeader>
          <CardContent>
            <CreateOrgForm />
          </CardContent>
        </Card>
        <Card className="duration-300 animate-in fade-in slide-in-from-top-2 motion-reduce:animate-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MailIcon className="size-5" aria-hidden="true" />
              {ORG_TEXT.ONBOARD_WAIT_TITLE}
            </CardTitle>
            <CardDescription>{ORG_TEXT.ONBOARD_WAIT_HINT}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {invites.status === "loading" ? <Skeleton className="h-12 w-full" /> : null}
            {invites.status === "ready" && invites.invites.length === 0 ? (
              <p className="text-sm text-muted-foreground">{ORG_TEXT.ONBOARD_NO_INVITES}</p>
            ) : null}
            {invites.status === "ready" && invites.invites.length > 0 ? (
              <>
                <p className="text-sm font-medium">{ORG_TEXT.ONBOARD_INVITES}</p>
                <ul className="flex flex-col gap-2">
                  {invites.invites.map((invite) => (
                    <li key={invite.invite_id} className="rounded-xl border p-3 duration-200 animate-in fade-in slide-in-from-top-2 motion-reduce:animate-none">
                      <p className="flex items-center gap-2 font-medium">
                        {invite.org_name}
                        <Badge variant="outline">{ORG_TEXT.ROLE_LABELS[invite.role]}</Badge>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ORG_TEXT.ONBOARD_INVITE_OPEN}
                        {invite.expires_at ? ` ${ORG_TEXT.EXPIRES} ${absoluteTime(new Date(invite.expires_at))}.` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
