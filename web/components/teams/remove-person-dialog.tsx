"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Trash2Icon } from "@/components/icons"
import { removalPreview, removePerson } from "@/lib/site-db"
import { removalSummary, type RemovalCounts } from "@/lib/remove-person"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type Removable = { _id: string; name: string }

function explain(error: unknown) {
  return error instanceof Error ? error.message : undefined
}

// Org admins remove someone from the organization: off every team, their agents and
// tokens deleted, and sign-in blocked. Their name stays on tickets, comments and files.
// Used by the Teams and Organization pages.
export function RemovePersonDialog({
  person,
  onOpenChange,
  onRemoved,
}: {
  person: Removable | null
  onOpenChange: (open: boolean) => void
  onRemoved: () => void
}) {
  // Counts are kept with whose they are, so a dialog for someone else never shows stale ones.
  const [preview, setPreview] = useState<{ id: string; counts: RemovalCounts | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const personId = person?._id
  const counts = preview && preview.id === personId ? preview.counts : null

  useEffect(() => {
    let cancelled = false
    if (!personId) return
    void removalPreview(personId).then((loaded) => {
      if (!cancelled) setPreview({ id: personId, counts: loaded })
    })
    return () => {
      cancelled = true
    }
  }, [personId])

  async function confirm() {
    if (!person) return
    setBusy(true)
    try {
      await removePerson(person._id)
      toast.success(`Removed ${person.name} from the organization`)
      onOpenChange(false)
      onRemoved()
    } catch (error) {
      toast.error(`Couldn't remove ${person.name}`, { description: explain(error) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={person !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {person?.name} from the organization?</DialogTitle>
          <DialogDescription>{person ? removalSummary(person.name, counts) : null}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" disabled={busy} onClick={() => void confirm()}>
            <Trash2Icon data-icon="inline-start" aria-hidden="true" />
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
