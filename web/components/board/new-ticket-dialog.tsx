"use client"

import { useState } from "react"
import { PlusIcon } from "lucide-react"

import type { Category } from "@/lib/types"
import { ColorDot } from "@/components/board/category-dialogs"
import { TagInput } from "@/components/board/tag-input"
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

// "+ New ticket" button and its form. Calls onCreate with what was typed.
export function NewTicketDialog({
  categories,
  tagSuggestions,
  onCreate,
}: {
  categories: Category[]
  tagSuggestions: string[]
  onCreate: (input: { title: string; status: string; tags: string[] }) => void
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [status, setStatus] = useState<string>()
  const [tags, setTags] = useState<string[]>([])
  // Default to the first column, and fall back to it if the picked one was deleted
  const startIn = categories.some((c) => c.slug === status) ? status : categories[0]?.slug

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !startIn) return
    onCreate({ title: title.trim(), status: startIn, tags })
    setTitle("")
    setTags([])
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
            <DialogDescription>You can move it to another column later.</DialogDescription>
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
            <Label htmlFor="ticket-status">Starts in</Label>
            <Select value={startIn} onValueChange={setStatus}>
              <SelectTrigger id="ticket-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    <ColorDot color={c.color} /> {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ticket-tags">Tags</Label>
            <TagInput
              id="ticket-tags"
              tags={tags}
              onChange={setTags}
              suggestions={tagSuggestions}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!title.trim() || !startIn}>
              Create ticket
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
