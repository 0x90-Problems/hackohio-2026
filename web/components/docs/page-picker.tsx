"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import type { Editor } from "@tiptap/core"

import { FileTextIcon, PlusIcon } from "@/components/icons"
import { type Folder, foldersApi } from "@/lib/folders-api"
import { cn } from "@/lib/utils"

const MAX_SHOWN = 8

type Open = { query: string; from: number; to: number; left: number; top: number }
type Option = { key: string; label: string; path?: string; id: string | null; name: string }

// What's typed after an unclosed [[ on the current line, if anything.
function readTrigger(editor: Editor): Open | null {
  const { selection } = editor.state
  const { $from, empty, from } = selection
  if (!empty || $from.parent.type.spec.code) return null
  const before = $from.parent.textBetween(0, $from.parentOffset, undefined, "￼")
  const match = /\[\[([^[\]|\n￼]{0,60})$/.exec(before)
  if (!match) return null
  const start = from - match[0].length
  const { left, bottom } = editor.view.coordsAtPos(start)
  return { query: match[1], from: start, to: from, left, top: bottom + 4 }
}

// The list that appears when you type [[. Pages load once per document: one call, then
// typing filters locally. `keysRef` lets the editor hand it the arrow and Enter keys.
export function PagePicker({
  editor,
  currentId,
  keysRef,
}: {
  editor: Editor
  currentId: string
  keysRef: React.RefObject<((event: KeyboardEvent) => boolean) | null>
}) {
  const [open, setOpen] = useState<Open | null>(null)
  const [pages, setPages] = useState<(Folder & { path?: string[] })[] | null>(null)
  const [active, setActive] = useState(0)
  const asked = useRef(false)

  useEffect(() => {
    const check = () => {
      const next = readTrigger(editor)
      setOpen(next)
      setActive(0)
      if (next && !asked.current) {
        asked.current = true
        foldersApi
          .search("", "note")
          .then((result) => setPages(result.items))
          .catch(() => setPages([]))
      }
    }
    editor.on("selectionUpdate", check)
    editor.on("update", check)
    return () => {
      editor.off("selectionUpdate", check)
      editor.off("update", check)
    }
  }, [editor])

  const query = open?.query.trim().toLowerCase() ?? ""
  const matches = (pages ?? []).filter((page) => page.id !== currentId && page.name.toLowerCase().includes(query)).slice(0, MAX_SHOWN)
  const exact = matches.some((page) => page.name.toLowerCase() === query)
  const options: Option[] = [
    ...matches.map((page) => ({ key: page.id, label: page.name, path: page.path?.join(" / "), id: page.id, name: page.name })),
    ...(query && !exact && open ? [{ key: "new", label: `Link to a new page “${open.query.trim()}”`, id: null, name: open.query.trim() }] : []),
  ]

  function pick(option: Option) {
    if (!open) return
    editor
      .chain()
      .focus()
      .deleteRange({ from: open.from, to: open.to })
      .insertContent([{ type: "pageLink", attrs: { id: option.id, name: option.name } }, { type: "text", text: " " }])
      .run()
    setOpen(null)
  }

  useEffect(() => {
    keysRef.current = (event) => {
      if (!open) return false
      if (event.key === "Escape") {
        setOpen(null)
        return true
      }
      if (!options.length) return false
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const step = event.key === "ArrowDown" ? 1 : -1
        setActive((current) => (current + step + options.length) % options.length)
        return true
      }
      if (event.key === "Enter" || event.key === "Tab") {
        pick(options[Math.min(active, options.length - 1)])
        return true
      }
      return false
    }
    return () => {
      keysRef.current = null
    }
  })

  if (!open) return null
  return (
    <div
      role="listbox"
      aria-label="Link to a page"
      style={{ left: open.left, top: open.top }}
      className="fixed z-50 flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-0.5 rounded-lg border bg-popover p-1 text-sm text-popover-foreground shadow-md motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150 print:hidden"
    >
      {pages === null && <p className="px-2 py-1.5 text-muted-foreground">Loading pages…</p>}
      {pages !== null && options.length === 0 && <p className="px-2 py-1.5 text-muted-foreground">Type a page name.</p>}
      {options.map((option, index) => (
        <button
          key={option.key}
          type="button"
          role="option"
          aria-selected={index === active}
          onMouseDown={(event) => event.preventDefault()} // keep the cursor in the document
          onClick={() => pick(option)}
          onMouseEnter={() => setActive(index)}
          className={cn("flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left", index === active && "bg-muted")}
        >
          {option.id ? <FileTextIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : <PlusIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{option.label}</span>
            {option.path && <span className="truncate text-xs text-muted-foreground">{option.path}</span>}
          </span>
        </button>
      ))}
    </div>
  )
}

// Pages that link to this one, as of their last saved version.
export function Backlinks({ documentId }: { documentId: string }) {
  const [items, setItems] = useState<Folder[] | null>(null)

  useEffect(() => {
    let cancelled = false
    foldersApi
      .backlinks(documentId)
      .then((result) => !cancelled && setItems(result.items))
      .catch(() => !cancelled && setItems(null))
    return () => {
      cancelled = true
    }
  }, [documentId])

  if (items === null) return null
  return (
    <section aria-label="Pages that link here" className="flex flex-col gap-2 border-t pt-4 print:hidden">
      <h2 className="font-mono text-xs tracking-widest text-muted-foreground uppercase">Linked from</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pages link here yet. Type [[ in another page to link to this one.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={`/docs/${encodeURIComponent(item.id)}`} className="inline-flex max-w-full items-center gap-2 text-sm hover:underline">
                <FileTextIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate">{item.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
