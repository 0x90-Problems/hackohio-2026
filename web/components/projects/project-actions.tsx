"use client"

import { useState } from "react"
import { ArchiveIcon, ArrowRightIcon, MoreHorizontalIcon, ShieldCheckIcon, Trash2Icon } from "@/components/icons"

import { APPROVAL_MODE_LABELS, APPROVAL_MODES, type ApprovalMode } from "@/shared/names"
import type { Project } from "@/lib/types"
import { cn } from "@/lib/utils"
import { MoveProjectDialog, useProjectMove } from "@/components/projects/move-project-dialog"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ProjectActions({
  project,
  onGone,
}: {
  project: Project
  onGone?: () => void
}) {
  const { archiveProject, deleteProject } = useProjects()
  const move = useProjectMove(project)
  const [confirming, setConfirming] = useState(false)
  const [moving, setMoving] = useState(false)
  const [approving, setApproving] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${project.name}`}>
            <MoreHorizontalIcon aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => archiveProject(project.key, !project.archived)}>
            <ArchiveIcon aria-hidden="true" />
            {project.archived ? "Restore" : "Archive"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setApproving(true)}>
            <ShieldCheckIcon aria-hidden="true" />
            Approval to close
          </DropdownMenuItem>
          {move && (
            <DropdownMenuItem onSelect={() => setMoving(true)}>
              <ArrowRightIcon aria-hidden="true" />
              Change team
            </DropdownMenuItem>
          )}
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
            <Trash2Icon aria-hidden="true" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {move && <MoveProjectDialog project={project} move={move} open={moving} onOpenChange={setMoving} onLostAccess={onGone} />}
      <ApprovalDialog project={project} open={approving} onOpenChange={setApproving} />
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {project.name}?</DialogTitle>
            <DialogDescription>
              This removes {project.key} and its tickets from the board. Archive keeps them and hides the project instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                deleteProject(project.key)
                setConfirming(false)
                onGone?.()
              }}
            >
              Delete project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

const APPROVAL_HINTS: Record<ApprovalMode, string> = {
  [APPROVAL_MODES.OFF]: "Anyone on the project closes tickets straight away.",
  [APPROVAL_MODES.AGENTS]: "When an agent moves a ticket to done, it waits until a person approves.",
  [APPROVAL_MODES.EVERYONE]: "Every move to done waits until another project member approves it.",
}

// Who needs approval to close a ticket in this project. Org admins and the team's managers can change it.
function ApprovalDialog({
  project,
  open,
  onOpenChange,
}: {
  project: Project
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { setProjectApproval } = useProjects()
  const current = project.approval ?? APPROVAL_MODES.AGENTS
  const [choice, setChoice] = useState<ApprovalMode>(current)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function change(next: boolean) {
    if (next) {
      setChoice(current)
      setError(null)
    }
    onOpenChange(next)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await setProjectApproval(project.key, choice)
      onOpenChange(false)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Couldn't save the approval setting")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approval to close</DialogTitle>
          <DialogDescription>
            Who needs another member of {project.name} to approve a move to done. The ticket stays where it is until then.
          </DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label="Who needs approval" className="flex flex-col gap-2">
          {Object.values(APPROVAL_MODES).map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={choice === mode}
              onClick={() => setChoice(mode)}
              className={cn(
                "flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-colors hover:bg-muted/60",
                choice === mode && "border-foreground bg-muted/60"
              )}
            >
              <span className="text-sm font-medium">{APPROVAL_MODE_LABELS[mode]}</span>
              <span className="text-xs text-muted-foreground">{APPROVAL_HINTS[mode]}</span>
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => change(false)}>
            Cancel
          </Button>
          <Button variant="outline" disabled={saving || choice === current} onClick={() => void save()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
