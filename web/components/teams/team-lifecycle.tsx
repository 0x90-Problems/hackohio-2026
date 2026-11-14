"use client"

import { useState } from "react"
import { toast } from "sonner"

import { ArchiveIcon, ArchiveRestoreIcon, Trash2Icon, UsersIcon } from "@/components/icons"
import { archiveTeam, deleteTeam, restoreTeam, type SiteState } from "@/lib/site-db"
import { deleteConfirmed, teamRef } from "@/lib/team-lifecycle"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// NSB-73: org admins archive a team (hidden from switchers, read-only, restorable) and delete
// an archived team once it holds no projects. The board enforces both; its reasons are shown.

type SiteTeam = SiteState["teams"][number]

function explain(error: unknown) {
  return error instanceof Error ? error.message : undefined
}

export function ArchiveTeamButton({ team, onArchived }: { team: SiteTeam; onArchived: () => void }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function archive() {
    setBusy(true)
    try {
      await archiveTeam(teamRef(team))
      toast.success(`Archived ${team.name}`, { description: "It's read-only now. You can restore it from Archived teams." })
      setOpen(false)
      onArchived()
    } catch (error) {
      toast.error("Couldn't archive the team", { description: explain(error) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ArchiveIcon data-icon="inline-start" aria-hidden="true" />
          Archive
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive {team.name}?</DialogTitle>
          <DialogDescription>
            It leaves the team switcher and becomes read-only: no new projects, tickets or members. Its projects, folders,
            documents, whiteboards and chat stay, and its members can still read them. You can restore it any time.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" variant="outline" disabled={busy} onClick={() => void archive()}>
            Archive team
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeleteTeamButton({ team, onDeleted }: { team: SiteTeam; onDeleted: () => void }) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState("")
  const [busy, setBusy] = useState(false)
  const confirmed = deleteConfirmed(typed, team.name)

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen)
        if (isOpen) setTyped("")
      }}
    >
      <DialogTrigger asChild>
        <Button variant="destructive">
          <Trash2Icon data-icon="inline-start" aria-hidden="true" />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault()
            if (!confirmed) return
            setBusy(true)
            try {
              await deleteTeam(teamRef(team))
              toast.success(`Deleted ${team.name}`)
              setOpen(false)
              onDeleted()
            } catch (error) {
              toast.error("Couldn't delete the team", { description: explain(error) })
            } finally {
              setBusy(false)
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Delete {team.name}?</DialogTitle>
            <DialogDescription>
              This can&apos;t be undone. The team must have no projects left; move or delete them first. Everyone comes off
              the team, and its name can&apos;t be used again in this organization.
            </DialogDescription>
          </DialogHeader>
          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            Its folders, documents, whiteboards and chat aren&apos;t erased, but no one will be able to open them again.
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="delete-team-name">
              Type <span className="font-semibold text-foreground">{team.name}</span> to confirm
            </Label>
            <Input id="delete-team-name" value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" autoFocus />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={!confirmed || busy}>
              Delete team
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Archived teams: read-only, with Restore and Delete for org admins. */
export function ArchivedTeams({
  teams,
  memberCount,
  canAdmin,
  onChanged,
}: {
  teams: SiteTeam[]
  memberCount: (team: SiteTeam) => number
  canAdmin: boolean
  onChanged: () => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  if (teams.length === 0) return null

  async function restore(team: SiteTeam) {
    setBusy(team.name)
    try {
      await restoreTeam(teamRef(team))
      toast.success(`Restored ${team.name}`)
      onChanged()
    } catch (error) {
      toast.error("Couldn't restore the team", { description: explain(error) })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className="border-dashed motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ArchiveIcon className="size-4" aria-hidden="true" />
          Archived teams
        </CardTitle>
        <CardDescription>
          Read-only and left out of the team switcher. Members can still read their projects, folders and chat.
          {canAdmin && " Restore one to use it again, or delete it once it has no projects."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y">
          {teams.map((team) => {
            const count = memberCount(team)
            return (
              <li key={team.name} className="flex flex-wrap items-center gap-3 py-3">
                <UsersIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{team.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {count} {count === 1 ? "person" : "people"}
                    {team.archived_at instanceof Date && ` · archived ${team.archived_at.toLocaleDateString()}`}
                  </span>
                </div>
                {canAdmin && (
                  <div className="flex gap-2">
                    <Button variant="outline" disabled={busy === team.name} onClick={() => void restore(team)}>
                      <ArchiveRestoreIcon data-icon="inline-start" aria-hidden="true" />
                      Restore
                    </Button>
                    <DeleteTeamButton team={team} onDeleted={onChanged} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
