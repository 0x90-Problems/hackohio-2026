"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { ORG_ERRORS, ORG_TEXT } from "@/shared/names"
import { LogOutIcon } from "@/components/icons"
import { useAuthUser } from "@/components/auth/auth-gate"
import { OrgApiError, leaveBlocked, type OrgMemberRow } from "@/lib/org-api"
import { chooseOrg } from "@/lib/team-choice"
import { orgApi, useOrgs } from "@/lib/use-orgs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// Leave the org in the top bar (profile page, NEXT_PUBLIC_MULTI_ORG). Blocked for its last admin,
// here and by the board (409 last_admin), with the same message either way.
export function LeaveOrgCard() {
  const account = useAuthUser()
  const state = useOrgs()
  const org = state.status === "ready" ? state.org : null
  const [members, setMembers] = useState<{ org: string; rows: OrgMemberRow[] } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [blockedByBoard, setBlockedByBoard] = useState(false)

  useEffect(() => {
    if (!org || org.role !== "admin") return
    let cancelled = false
    orgApi.members(org.org_id).then(
      (rows) => !cancelled && setMembers({ org: org.org_id, rows }),
      () => undefined
    )
    return () => {
      cancelled = true
    }
  }, [org])

  if (!org || !account) return null
  const rows = members?.org === org.org_id ? members.rows : null
  const blocked = blockedByBoard || leaveBlocked(org.role, account._id, rows)

  async function leave() {
    if (!org || busy) return
    setBusy(true)
    try {
      await orgApi.leave(org.org_id)
      chooseOrg(null)
      toast.success(ORG_TEXT.LEFT)
      window.location.assign("/projects")
    } catch (error) {
      if (error instanceof OrgApiError && error.code === ORG_ERRORS.LAST_ADMIN) setBlockedByBoard(true)
      else toast.error(error instanceof Error ? error.message : ORG_TEXT.ACTION_FAILED)
      setConfirming(false)
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{ORG_TEXT.LEAVE_TITLE}</CardTitle>
        <CardDescription>
          {org.name}. {ORG_TEXT.LEAVE_HINT}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-3">
        {blocked ? (
          <p role="status" className="text-sm text-muted-foreground">
            {ORG_TEXT.LAST_ADMIN}
          </p>
        ) : null}
        <Button variant="destructive" disabled={blocked || busy} onClick={() => setConfirming(true)}>
          <LogOutIcon aria-hidden="true" />
          {ORG_TEXT.LEAVE}
        </Button>
      </CardContent>
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ORG_TEXT.LEAVE_CONFIRM}</DialogTitle>
            <DialogDescription>
              {org.name}. {ORG_TEXT.LEAVE_HINT}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{ORG_TEXT.CANCEL}</Button>
            </DialogClose>
            <Button variant="destructive" disabled={busy} onClick={() => void leave()}>
              {ORG_TEXT.LEAVE}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
