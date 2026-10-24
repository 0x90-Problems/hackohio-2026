"use client"

import { useState } from "react"
import { PlusIcon } from "lucide-react"

import { tickets as allTickets } from "@/lib/mock-data"
import { Button } from "@/components/ui/button"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const LABELS = [...new Set(allTickets.flatMap((t) => (t.label ? [t.label] : [])))].sort()

// "+ New ticket" button and its form. Calls onCreate with what was typed.
export function NewTicketDialog({
  onCreate,
}: {
  onCreate: (input: { title: string; label?: string }) => void
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [label, setLabel] = useState<string>()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    onCreate({ title: title.trim(), label })
    setTitle("")
    setLabel(undefined)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon data-icon="inline-start" />
          New ticket
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New ticket</DialogTitle>
            <DialogDescription>It starts in Backlog. You can move it later.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ticket-title">Title</Label>
            <Input
              id="ticket-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Add search to the board"
              autoFocus
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ticket-label">Category</Label>
            <Select value={label} onValueChange={setLabel}>
              <SelectTrigger id="ticket-label" className="w-full">
                <SelectValue placeholder="Pick a category (optional)" />
              </SelectTrigger>
              <SelectContent>
                {LABELS.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!title.trim()}>
              Create ticket
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
