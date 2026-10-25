"use client"

import { useState } from "react"
import { ArchiveIcon, MoreHorizontalIcon, Trash2Icon } from "@/components/icons"

import type { Project } from "@/lib/types"
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
  onDeleted,
}: {
  project: Project
  onDeleted?: () => void
}) {
  const { archiveProject, deleteProject } = useProjects()
  const [confirming, setConfirming] = useState(false)

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
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
            <Trash2Icon aria-hidden="true" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
                onDeleted?.()
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
