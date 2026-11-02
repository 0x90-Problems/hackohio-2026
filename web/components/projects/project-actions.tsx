"use client"

import { useState } from "react"
import { ArchiveIcon, ArrowRightIcon, MoreHorizontalIcon, Trash2Icon } from "@/components/icons"

import type { Project } from "@/lib/types"
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
