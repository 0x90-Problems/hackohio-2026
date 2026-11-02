"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { XIcon } from "@/components/icons"
import { cn } from "@/lib/utils"
import { describeRow, matchesFilter, type OutlineRow } from "@/lib/whiteboard-outline"

// Every shape on the board as a list: arrows to move, Enter to show one on the canvas.
export function OutlinePanel({
  rows,
  selected,
  onShow,
  onFocusCanvas,
  onClose,
}: {
  rows: OutlineRow[]
  selected: ReadonlySet<string>
  onShow: (id: string) => void
  onFocusCanvas: () => void
  onClose: () => void
}) {
  const [filter, setFilter] = useState("")
  const [activeId, setActiveId] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState("")
  const list = useRef<HTMLUListElement>(null)

  const shown = useMemo(() => rows.filter((row) => matchesFilter(row, filter)), [rows, filter])
  // The shape someone is on can vanish when another person deletes it: fall back to the first row.
  const active = shown.find((row) => row.id === activeId) ?? shown[0] ?? null

  // Keyboard focus starts here when the panel opens.
  useEffect(() => {
    list.current?.focus()
  }, [])

  useEffect(() => {
    if (active) list.current?.querySelector(`[data-row="${CSS.escape(active.id)}"]`)?.scrollIntoView({ block: "nearest" })
  }, [active])

  // Quietly say when other people's changes alter the list.
  const count = rows.length
  const lastCount = useRef(count)
  useEffect(() => {
    if (count === lastCount.current) return
    const timer = setTimeout(() => {
      lastCount.current = count
      setAnnouncement(`The board now has ${count} ${count === 1 ? "shape" : "shapes"}.`)
    }, 2000)
    return () => clearTimeout(timer)
  }, [count])

  function show(row: OutlineRow) {
    setActiveId(row.id)
    onShow(row.id)
    setAnnouncement(`Showing ${describeRow(row)}.`)
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (!shown.length) return
    const at = active ? shown.indexOf(active) : 0
    const move = (to: number) => {
      event.preventDefault()
      setActiveId(shown[Math.max(0, Math.min(to, shown.length - 1))].id)
    }
    if (event.key === "ArrowDown") move(at + 1)
    else if (event.key === "ArrowUp") move(at - 1)
    else if (event.key === "Home") move(0)
    else if (event.key === "End") move(shown.length - 1)
    else if (event.key === "PageDown") move(at + 10)
    else if (event.key === "PageUp") move(at - 10)
    else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      if (active) show(active)
      if (event.key === "Enter" && event.shiftKey) onFocusCanvas()
    }
  }

  return (
    <aside
      aria-label="Board outline"
      className="absolute inset-y-0 right-0 z-10 flex w-80 max-w-full flex-col border-l bg-background motion-safe:animate-in motion-safe:slide-in-from-right-2 motion-safe:duration-150 lg:static lg:shrink-0"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation()
          onClose()
        }
      }}
    >
      <div className="flex items-center gap-2 border-b p-3">
        <h2 className="text-sm font-semibold">Outline</h2>
        <span className="text-xs text-muted-foreground">
          {count} {count === 1 ? "shape" : "shapes"}
        </span>
        <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label="Close outline" onClick={onClose}>
          <XIcon aria-hidden="true" />
        </Button>
      </div>
      <div className="border-b p-3">
        <Input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter shapes" aria-label="Filter shapes" className="h-8" />
      </div>
      <p id="wb-outline-help" className="border-b px-3 py-2 text-xs text-muted-foreground">
        Arrow keys move. Enter shows the shape. Shift+Enter shows it and moves to the canvas. Esc closes.
      </p>
      {shown.length ? (
        <ul
          ref={list}
          role="listbox"
          tabIndex={0}
          aria-label="Shapes on this board"
          aria-describedby="wb-outline-help"
          aria-activedescendant={active ? `wb-outline-${active.id}` : undefined}
          onKeyDown={onKeyDown}
          className="min-h-0 flex-1 overflow-y-auto p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          {shown.map((row) => (
            <li
              key={row.id}
              id={`wb-outline-${row.id}`}
              data-row={row.id}
              role="option"
              aria-selected={selected.has(row.id)}
              aria-label={describeRow(row)}
              onClick={() => show(row)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted",
                row.inFrame && "ml-4",
                active?.id === row.id && "bg-muted ring-1 ring-border",
                selected.has(row.id) && "font-medium"
              )}
            >
              <span className="shrink-0 text-xs text-muted-foreground">{row.kind}</span>
              {row.label ? <span className="min-w-0 truncate">{row.label}</span> : null}
              {row.byAgent ? (
                <Badge variant="outline" className="ml-auto shrink-0 border-dashed text-muted-foreground">
                  AGENT
                </Badge>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p ref={list as unknown as React.Ref<HTMLParagraphElement>} tabIndex={0} className="p-4 text-sm text-muted-foreground">
          {rows.length ? "No shapes match that filter." : "Nothing on this board yet."}
        </p>
      )}
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>
    </aside>
  )
}
