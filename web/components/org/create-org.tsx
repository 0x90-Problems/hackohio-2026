"use client"

import { useState } from "react"
import { toast } from "sonner"

import { ORG_ERRORS, ORG_TEXT } from "@/shared/names"
import { OrgApiError, validOrgName } from "@/lib/org-api"
import { chooseOrg } from "@/lib/team-choice"
import { orgApi } from "@/lib/use-orgs"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function explain(error: unknown): string | undefined {
  if (error instanceof OrgApiError && error.code === ORG_ERRORS.RATE_LIMITED) return ORG_TEXT.RATE_LIMITED
  return error instanceof Error ? error.message : undefined
}

// Name → the board makes the org with a General team and you as admin → you land on its board.
export function CreateOrgForm({ onCancel, autoFocus = false }: { onCancel?: () => void; autoFocus?: boolean }) {
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const valid = validOrgName(name)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    try {
      const created = await orgApi.createOrg(name)
      chooseOrg({ org: created.org_id, team: created.team.team_id })
      window.location.assign("/projects")
    } catch (error) {
      toast.error(ORG_TEXT.CREATE_FAILED, { description: explain(error) })
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="org-name">{ORG_TEXT.NAME_LABEL}</Label>
        <Input
          id="org-name"
          name="org-name"
          value={name}
          maxLength={60}
          autoComplete="off"
          autoFocus={autoFocus}
          onChange={(event) => setName(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">{ORG_TEXT.NAME_HINT}</p>
      </div>
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            {ORG_TEXT.CANCEL}
          </Button>
        ) : null}
        <Button type="submit" disabled={!valid || busy}>
          {busy ? ORG_TEXT.CREATING : ORG_TEXT.CREATE}
        </Button>
      </div>
    </form>
  )
}

export function CreateOrgDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{ORG_TEXT.CREATE_TITLE}</DialogTitle>
          <DialogDescription>{ORG_TEXT.CREATE_HINT}</DialogDescription>
        </DialogHeader>
        <CreateOrgForm autoFocus onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}
