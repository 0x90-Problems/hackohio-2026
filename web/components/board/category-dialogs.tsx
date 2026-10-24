"use client"

import { useState } from "react"
import { CheckIcon } from "lucide-react"

import type { Category } from "@/lib/types"
import {
  CATEGORY_COLORS,
  CATEGORY_COLOR_NAMES,
  type CategoryColor,
} from "@/lib/categories"
import { cn } from "@/lib/utils"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function ColorDot({ color, className }: { color: CategoryColor; className?: string }) {
  return (
    <span
      className={cn("size-2.5 shrink-0 rounded-full", CATEGORY_COLORS[color].dot, className)}
      aria-hidden
    />
  )
}

// Create a category, or rename/recolor one when `category` is given.
// The parent mounts this only while it's open, so the form starts fresh each time.
export function CategoryDialog({
  category,
  onSave,
  onClose,
}: {
  category?: Category
  onSave: (input: { name: string; color: CategoryColor }) => void
  onClose: () => void
}) {
  const [name, setName] = useState(category?.name ?? "")
  const [color, setColor] = useState<CategoryColor>(category?.color ?? "gray")

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onSave({ name: name.trim(), color })
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{category ? "Edit category" : "New category"}</DialogTitle>
            <DialogDescription>
              Categories are the columns on the board.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="category-name">Name</Label>
            <Input
              id="category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Testing"
              autoFocus
              required
            />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Color</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup">
              {CATEGORY_COLOR_NAMES.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={color === c}
                  aria-label={CATEGORY_COLORS[c].label}
                  title={CATEGORY_COLORS[c].label}
                  onClick={() => setColor(c)}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-shadow",
                    CATEGORY_COLORS[c].dot,
                    color === c && "ring-2 ring-foreground"
                  )}
                >
                  {color === c && <CheckIcon className="size-4 text-white" />}
                </button>
              ))}
            </div>
          </fieldset>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!name.trim()}>
              {category ? "Save" : "Create category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Confirms deleting a category. Its tickets move to the category picked here.
export function DeleteCategoryDialog({
  category,
  others,
  ticketCount,
  onDelete,
  onClose,
}: {
  category: Category
  others: Category[]
  ticketCount: number
  onDelete: (moveTo: string) => void
  onClose: () => void
}) {
  const [moveTo, setMoveTo] = useState(others[0]?.slug)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{category.name}”?</DialogTitle>
          <DialogDescription>
            {ticketCount === 0
              ? "This column is empty, so no tickets are affected."
              : `Its ${ticketCount} ticket${ticketCount === 1 ? "" : "s"} will move to the category you pick.`}
          </DialogDescription>
        </DialogHeader>
        {ticketCount > 0 && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="move-to">Move tickets to</Label>
            <Select value={moveTo} onValueChange={setMoveTo}>
              <SelectTrigger id="move-to" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {others.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    <ColorDot color={c.color} /> {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={!moveTo}
            onClick={() => {
              if (!moveTo) return
              onDelete(moveTo)
              onClose()
            }}
          >
            Delete category
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
