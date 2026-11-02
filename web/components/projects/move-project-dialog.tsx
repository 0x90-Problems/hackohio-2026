"use client"

import { useEffect, useState } from "react"

import { AlertTriangleIcon } from "@/components/icons"
import type { Project } from "@/lib/types"
import { moveOptions, peopleLosingAccess } from "@/lib/project-move"
import { loadSite, type SiteState } from "@/lib/site-db"
import { useAuthUser } from "@/components/auth/auth-gate"
import { useProjects } from "@/components/projects/projects-store"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const SITE_TTL_MS = 60_000
const NAMES_SHOWN = 5

// The Projects page has a menu on every card, so they share one load.
let shared: { user: string; at: number; site: Promise<SiteState> } | null = null

function sharedSite(user: string) {
  if (!shared || shared.user !== user || Date.now() - shared.at > SITE_TTL_MS) {
    const site = loadSite()
    const entry = { user, at: Date.now(), site }
    shared = entry
    site.catch(() => {
      if (shared === entry) shared = null
    })
  }
  return shared.site
}

/** Whether you can move this project, and the teams it could go to. Null until the teams load, and if they can't. */
export function useProjectMove(project: Project) {
  const account = useAuthUser()
  const [site, setSite] = useState<SiteState | null>(null)
  const userId = account?._id

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    sharedSite(userId)
      .then((loaded) => {
        if (!cancelled) setSite(loaded)
      })
      .catch(() => undefined) // no menu item, same as someone who can't move it
    return () => {
      cancelled = true
    }
  }, [userId])

  if (!site || !userId) return null
  const options = moveOptions(project, site, userId, account?.admin === true)
  return options && { ...options, users: site.users }
}

function namesText(names: string[]) {
  const shown = names.slice(0, NAMES_SHOWN)
  const more = names.length - shown.length
  return more > 0 ? `${shown.join(", ")} and ${more} more` : shown.join(", ")
}

export function MoveProjectDialog({
  project,
  move,
  open,
  onOpenChange,
  onLostAccess,
}: {
  project: Project
  move: NonNullable<ReturnType<typeof useProjectMove>>
  open: boolean
  onOpenChange: (open: boolean) => void
  onLostAccess?: () => void
}) {
  const { moveProject } = useProjects()
  const [target, setTarget] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const leaving = peopleLosingAccess(project, move.users, target)
  const losesAccess = !move.isAdmin && !move.myTeams.includes(target)

  function setOpen(next: boolean) {
    onOpenChange(next)
    if (!next) {
      setTarget("")
      setError("")
    }
  }

  async function confirm() {
    setBusy(true)
    setError("")
    try {
      await moveProject(project.key, target, losesAccess)
      setOpen(false)
      if (losesAccess) onLostAccess?.()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not move the project")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="break-words">Move {project.name} to another team</DialogTitle>
          <DialogDescription className="break-words">
            {project.unassigned ? "This project isn't on a team, so everyone can see it." : `It's on ${project.team} now.`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor={`move-team-${project.key}`}>New team</Label>
          <Select
            value={target}
            onValueChange={(next) => {
              setTarget(next)
              setError("")
            }}
          >
            <SelectTrigger id={`move-team-${project.key}`} className="w-full">
              <SelectValue placeholder="Choose a team" />
            </SelectTrigger>
            <SelectContent>
              {move.targets.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {target && (
          <div className="flex gap-3 rounded-lg border p-3 text-sm">
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="flex min-w-0 flex-col gap-1.5 break-words">
              <p className="font-medium">People who aren&apos;t on {target} lose access to this project and its tickets. So do their agents.</p>
              {leaving.length > 0 ? (
                <p className="text-muted-foreground">
                  {leaving.length === 1 ? "That's" : `That's ${leaving.length} people:`} {namesText(leaving.map((user) => user.name))}.
                </p>
              ) : (
                <p className="text-muted-foreground">No one loses access right now.</p>
              )}
              {losesAccess && <p className="font-medium">You aren&apos;t on {target}, so you&apos;ll lose access too.</p>}
              <p className="text-muted-foreground">Org admins keep access.</p>
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm break-words text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="secondary" disabled={!target || busy} onClick={() => void confirm()}>
            {busy ? "Moving…" : "Move project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
