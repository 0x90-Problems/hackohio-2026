"use client"

import { useRef, useState } from "react"

import { ArrowRightIcon, XIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { type DropTarget, dropCheck, NODE_DRAG_TYPE } from "@/lib/files-move"
import type { Folder } from "@/lib/folders-api"
import { cn } from "@/lib/utils"

export const canEdit = (role?: Folder["role"]) => role === "editor" || role === "manager"

// Picking several items in the listing. The same in both layouts; trash has none.
export type Selection = {
  has: (id: string) => boolean
  /** Only items you could move can be picked: moving is all a selection is for. */
  can: (node: Folder) => boolean
  toggle: (node: Folder, shift: boolean) => void
  all: boolean | "indeterminate"
  toggleAll: () => void
  count: number
  selectable: number
}

/** A checkbox for one item, or for all of them. Shift-click picks the range from the last one clicked. */
export function SelectBox({
  label,
  checked,
  disabled,
  onToggle,
  className,
}: {
  label: string
  checked: boolean | "indeterminate"
  disabled?: boolean
  onToggle: (shift: boolean) => void
  className?: string
}) {
  return (
    <Checkbox
      checked={checked}
      disabled={disabled}
      aria-label={label}
      // Controlled: the click decides, so it can see the shift key.
      onClick={(event) => {
        event.stopPropagation()
        onToggle(event.shiftKey)
      }}
      onDoubleClick={(event) => event.stopPropagation()}
      className={cn("data-[state=checked]:border-foreground data-[state=checked]:bg-foreground data-[state=checked]:text-background data-[state=indeterminate]:border-foreground", className)}
    />
  )
}

export function SelectionBar({ count, busy, onMove, onClear }: { count: number; busy: boolean; onMove: () => void; onClear: () => void }) {
  return (
    <div
      role="toolbar"
      aria-label="Selected items"
      className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-1.5 text-sm motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-150"
    >
      <span className="font-medium" aria-live="polite">
        {count} selected
      </span>
      <span aria-hidden="true" className="text-muted-foreground">
        ·
      </span>
      <Button variant="outline" size="sm" disabled={busy} onClick={onMove}>
        <ArrowRightIcon data-icon="inline-start" aria-hidden="true" />
        Move to…
      </Button>
      <Button variant="ghost" size="sm" disabled={busy} onClick={onClear}>
        <XIcon data-icon="inline-start" aria-hidden="true" />
        Clear
      </Button>
    </div>
  )
}

type Target = DropTarget & { role?: Folder["role"] }
type DragHandlers = Pick<React.HTMLAttributes<HTMLElement>, "onDragEnter" | "onDragOver" | "onDragLeave" | "onDrop">

// Drag and drop in Folders. Items dragged within the page carry NODE_DRAG_TYPE; files from
// the computer carry "Files" and upload instead. The browser only shows the types until the
// drop, so what's being dragged is kept here.
export type NodeDrag = {
  /** The folder being hovered with something it would take. */
  overId: string | null
  announcement: string
  source: (node: Folder) => Pick<React.HTMLAttributes<HTMLElement>, "draggable" | "onDragStart" | "onDragEnd">
  /** filesOnly: a background area that takes uploads but isn't somewhere to move items. */
  target: (target: Target, options?: { filesOnly?: boolean }) => DragHandlers
}

export const dropHighlight = "bg-muted ring-2 ring-ring ring-inset"

export function useNodeDrag({
  parentId,
  dragged,
  canUploadHere,
  onMove,
  onUpload,
}: {
  /** The folder being listed: everything that can be dragged is in it. */
  parentId: string
  /** What dragging this item takes along: the whole selection when it's part of it. */
  dragged: (node: Folder) => Folder[]
  canUploadHere: boolean
  onMove: (nodes: Folder[], target: Target) => void
  onUpload: (files: File[], target: Target) => void
}): NodeDrag {
  const [overId, setOverId] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState("")
  const dragging = useRef<Folder[] | null>(null)
  // dragover fires constantly; say each target once.
  const said = useRef<string | null>(null)

  const say = (key: string, text: string) => {
    if (said.current === key) return
    said.current = key
    setAnnouncement(text)
  }

  const kindOf = (event: React.DragEvent) =>
    event.dataTransfer.types.includes(NODE_DRAG_TYPE) ? "nodes" : event.dataTransfer.types.includes("Files") ? "files" : null

  const what = (nodes: Folder[]) => (nodes.length === 1 ? nodes[0].name : `${nodes.length} items`)

  // What this drop would do, or why it can't happen.
  function check(event: React.DragEvent, target: Target, filesOnly: boolean): { ok: true; nodes?: Folder[] } | { ok: false; reason?: string } {
    const kind = kindOf(event)
    if (kind === null || (kind === "nodes" && filesOnly)) return { ok: false }
    if (target.role !== undefined && !canEdit(target.role)) return { ok: false, reason: `You can't add to ${target.name}.` }
    if (kind === "files") return filesOnly && !canUploadHere ? { ok: false } : { ok: true }
    // Dragged from another tab: nothing here to move.
    if (!dragging.current) return { ok: false }
    const result = dropCheck(
      dragging.current.map((node) => ({ node, id: node.id, type: node.type, parent: parentId })),
      target
    )
    return result.ok ? { ok: true, nodes: result.nodes.map((entry) => entry.node) } : result
  }

  return {
    overId,
    announcement,
    source: (node) => ({
      draggable: true,
      onDragStart: (event) => {
        const nodes = dragged(node)
        dragging.current = nodes
        // Drop whatever the browser added (a thumbnail's image, say), so only our type is offered.
        event.dataTransfer.clearData()
        event.dataTransfer.setData(NODE_DRAG_TYPE, JSON.stringify(nodes.map((each) => each.id)))
        event.dataTransfer.effectAllowed = "move"
        if (nodes.length > 1) {
          // A small "3 items" chip instead of a picture of one row.
          const chip = document.createElement("div")
          chip.textContent = `${nodes.length} items`
          chip.style.cssText =
            "position:fixed;top:-100px;left:0;padding:4px 10px;border-radius:9999px;font:500 13px system-ui,sans-serif;background:#171717;color:#fafafa"
          document.body.appendChild(chip)
          event.dataTransfer.setDragImage(chip, -8, -8)
          setTimeout(() => chip.remove(), 0)
        }
        said.current = null
        setAnnouncement(`Dragging ${what(nodes)}. Drop on a folder to move ${nodes.length === 1 ? "it" : "them"}.`)
      },
      onDragEnd: () => {
        dragging.current = null
        said.current = null
        setOverId(null)
      },
    }),
    target: (target, options) => {
      const filesOnly = options?.filesOnly ?? false
      const over = (event: React.DragEvent) => {
        const result = check(event, target, filesOnly)
        if (!result.ok) {
          if (!result.reason) return
          // A clear no: don't let the listing behind take it either.
          event.preventDefault()
          event.stopPropagation()
          event.dataTransfer.dropEffect = "none"
          say(`no:${target.id}`, result.reason)
          return
        }
        // Taken here, so a folder inside the listing wins over the listing itself.
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = result.nodes ? "move" : "copy"
        setOverId(target.id)
        if (result.nodes) say(`move:${target.id}`, `Drop to move ${what(result.nodes)} into ${target.name}.`)
        else say(`upload:${target.id}`, `Drop to upload into ${target.name}.`)
      }
      return {
        onDragEnter: over,
        onDragOver: over,
        onDragLeave: (event) => {
          // Moving onto a child of the target isn't leaving it.
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
          setOverId((current) => (current === target.id ? null : current))
          said.current = null
        },
        onDrop: (event) => {
          const result = check(event, target, filesOnly)
          setOverId(null)
          said.current = null
          if (!result.ok) {
            if (result.reason) {
              event.preventDefault()
              event.stopPropagation()
            }
            return
          }
          event.preventDefault()
          event.stopPropagation()
          if (result.nodes) {
            dragging.current = null
            onMove(result.nodes, target)
          } else {
            const files = Array.from(event.dataTransfer.files)
            if (files.length > 0) onUpload(files, target)
          }
        },
      }
    },
  }
}
