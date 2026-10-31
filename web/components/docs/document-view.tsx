"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { Markdown } from "@tiptap/markdown"
import Collaboration from "@tiptap/extension-collaboration"
import CollaborationCaret from "@tiptap/extension-collaboration-caret"
import { TaskItem, TaskList } from "@tiptap/extension-list"

import { useAuthUser } from "@/components/auth/auth-gate"
import { PageBreak, PageLink, PaperPages, setPaperLayout } from "@/components/docs/doc-extensions"
import { EditorToolbar } from "@/components/docs/editor-toolbar"
import { Backlinks, PagePicker } from "@/components/docs/page-picker"
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, FileTextIcon, LockIcon, PlusIcon, PrinterIcon, WifiIcon, WifiOffIcon } from "@/components/icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { colorFor, LiveProvider, type LiveStatus } from "@/lib/docs-live"
import { type Crumb, type Folder, FoldersError, foldersApi } from "@/lib/folders-api"
import { cn } from "@/lib/utils"

const AUTOSAVE_MS = 2 * 60_000
const VIEW_KEY = "nutshell.docs.view"
const INCH = 96
const MARGIN = INCH
const SHEET_GAP = 24
// Sheets at the browser's 96 pixels to an inch, so the screen matches what prints.
const SHEETS = {
  letter: { label: "Letter", css: "letter", width: 8.5 * INCH, height: 11 * INCH },
  a4: { label: "A4", css: "A4", width: 794, height: 1123 },
}
type SheetSize = keyof typeof SHEETS

function storedView(): "flow" | "pages" {
  try {
    return localStorage.getItem(VIEW_KEY) === "pages" ? "pages" : "flow"
  } catch {
    return "flow" // private window or blocked storage
  }
}

function explain(error: unknown) {
  return error instanceof FoldersError ? error.message : "Something went wrong. Try again."
}

type Loaded = { note: Folder; body: string; crumbs: Crumb[]; rootId: string; canEdit: boolean }

// A document page: the page tree on the left, the editor on the right.
export function DocumentView({ documentId }: { documentId: string }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        // readNote has the text; node has your role on it (readNote's copy doesn't).
        const [read, path, node] = await Promise.all([foldersApi.readNote(documentId), foldersApi.path(documentId), foldersApi.node(documentId)])
        const crumbs = path.items
        // The document that owns the tree: the outermost document above this page (or this page).
        let rootId = documentId
        for (const crumb of crumbs) {
          if (crumb.id === documentId) break
          const node = await foldersApi.readNote(crumb.id).catch(() => null)
          if (node) {
            rootId = crumb.id
            break
          }
        }
        if (!cancelled) {
          const note = { ...read.note, role: node.role }
          setLoaded({ note, body: read.body ?? "", crumbs, rootId, canEdit: node.role === "editor" || node.role === "manager" })
        }
      } catch (error) {
        if (!cancelled) setFailure(explain(error))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [documentId])

  if (failure) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-8 text-center">
        <FileTextIcon className="size-10 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-lg font-semibold">Couldn&apos;t open this document</h1>
        <p className="max-w-sm text-sm text-muted-foreground">{failure}</p>
        <Button asChild variant="outline">
          <Link href="/files">Back to Folders</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-[calc(100svh-3.5rem)] max-w-screen-2xl">
      <PageTree rootId={loaded?.rootId ?? null} currentId={documentId} canEdit={loaded?.canEdit ?? false} />
      <main className="min-w-0 flex-1">
        {loaded ? <Editor key={documentId} loaded={loaded} /> : <EditorSkeleton />}
      </main>
    </div>
  )
}

// -- page tree ---------------------------------------------------------------------

function PageTree({ rootId, currentId, canEdit }: { rootId: string | null; currentId: string; canEdit: boolean }) {
  const router = useRouter()
  const [root, setRoot] = useState<Folder | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!rootId) return
    let cancelled = false
    void foldersApi.readNote(rootId).then((r) => !cancelled && setRoot(r.note)).catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [rootId, version])

  const addPage = async (parentId: string) => {
    try {
      const page = await foldersApi.createNote(parentId, `Untitled ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`, "")
      setVersion((v) => v + 1)
      router.push(`/docs/${encodeURIComponent(page.id)}`)
    } catch (error) {
      toast.error(explain(error))
    }
  }

  return (
    <aside aria-label="Pages" className="hidden w-64 shrink-0 flex-col gap-2 border-r bg-muted/30 p-3 md:flex">
      <Button asChild variant="ghost" size="sm" className="justify-start">
        <Link href={root?.parent_id && root.parent_id !== "root" ? `/files?folder=${encodeURIComponent(root.parent_id)}` : "/files"}>
          <ChevronLeftIcon aria-hidden="true" /> Folders
        </Link>
      </Button>
      {root ? (
        <ul role="tree" aria-label="Pages in this document" className="flex flex-col">
          <TreeItem key={`${root.id}:${version}`} node={root} depth={0} currentId={currentId} canEdit={canEdit} onAdd={addPage} initiallyOpen />
        </ul>
      ) : (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-3/4" />
        </div>
      )}
      {canEdit && root ? (
        <Button variant="ghost" size="sm" className="justify-start text-muted-foreground" onClick={() => void addPage(currentId)}>
          <PlusIcon aria-hidden="true" /> Add page here
        </Button>
      ) : null}
    </aside>
  )
}

function TreeItem({
  node,
  depth,
  currentId,
  canEdit,
  onAdd,
  initiallyOpen = false,
}: {
  node: Folder
  depth: number
  currentId: string
  canEdit: boolean
  onAdd: (parentId: string) => void
  initiallyOpen?: boolean
}) {
  const [open, setOpen] = useState(initiallyOpen)
  const [children, setChildren] = useState<Folder[] | null>(null)

  useEffect(() => {
    if (!open || children) return
    let cancelled = false
    void foldersApi
      .children(node.id)
      .then((page) => !cancelled && setChildren(page.items.filter((item) => item.type === "note")))
      .catch(() => !cancelled && setChildren([]))
    return () => {
      cancelled = true
    }
  }, [open, children, node.id])

  const current = node.id === currentId
  return (
    <li role="treeitem" aria-expanded={open} aria-selected={current}>
      <div className={cn("group flex items-center gap-1 rounded-md pr-1 text-sm hover:bg-muted", current && "bg-muted font-medium")} style={{ paddingLeft: depth * 12 }}>
        <button type="button" aria-label={open ? `Collapse ${node.name}` : `Expand ${node.name}`} onClick={() => setOpen((o) => !o)} className="rounded p-1 text-muted-foreground hover:text-foreground">
          {open ? <ChevronDownIcon className="size-3.5" aria-hidden="true" /> : <ChevronRightIcon className="size-3.5" aria-hidden="true" />}
        </button>
        <Link href={`/docs/${encodeURIComponent(node.id)}`} aria-current={current ? "page" : undefined} className="min-w-0 flex-1 truncate py-1">
          {node.name}
        </Link>
        {canEdit ? (
          <button type="button" aria-label={`Add a page inside ${node.name}`} onClick={() => onAdd(node.id)} className="rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100">
            <PlusIcon className="size-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {open && children?.length ? (
        <ul role="group">
          {children.map((child) => (
            <TreeItem key={child.id} node={child} depth={depth + 1} currentId={currentId} canEdit={canEdit} onAdd={onAdd} initiallyOpen={currentId === child.id} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

// -- editor ----------------------------------------------------------------------

function Editor({ loaded }: { loaded: Loaded }) {
  const me = useAuthUser()
  const [status, setStatus] = useState<LiveStatus>("connecting")
  const [readOnly, setReadOnly] = useState(!loaded.canEdit)
  const [note, setNote] = useState(loaded.note)
  const [saving, setSaving] = useState(false)
  const dirty = useRef(false)
  const provider = useMemo(() => new LiveProvider(loaded.note.id), [loaded.note.id])
  const live = status !== "off"
  const router = useRouter()
  const pickerKeys = useRef<((event: KeyboardEvent) => boolean) | null>(null)
  const followLink = useRef<(id: string | null, name: string, pos: number) => void>(() => undefined)
  // How you look at it is your own choice; the paper size belongs to the document.
  const [view, setView] = useState<"flow" | "pages">(storedView)
  const [size, setSize] = useState<SheetSize>("letter")
  const [pages, setPages] = useState(1)
  const sheet = SHEETS[size]

  useEffect(() => () => provider.destroy(), [provider])

  useEffect(() => {
    const settings = provider.doc.getMap<string>("document")
    const read = () => {
      const saved = settings.get("paper")
      if (saved === "letter" || saved === "a4") setSize(saved)
    }
    settings.observe(read)
    return () => settings.unobserve(read)
  }, [provider])

  function chooseSize(next: SheetSize) {
    setSize(next)
    if (!readOnly) provider.doc.getMap<string>("document").set("paper", next)
  }

  function chooseView(next: "flow" | "pages") {
    setView(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      // private window or blocked storage: it just won't be remembered
    }
  }

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable: loaded.canEdit,
      extensions: [
        // Collaboration brings its own undo history (per person), so StarterKit's is off.
        StarterKit.configure({ undoRedo: false, link: { openOnClick: false, autolink: true, protocols: ["https"] } }),
        TaskList,
        TaskItem.configure({ nested: true }),
        PageLink,
        PageBreak,
        PaperPages,
        Markdown,
        Collaboration.configure({ document: provider.doc }),
        CollaborationCaret.configure({
          provider: { awareness: provider.awareness },
          user: { name: me?.name ?? "You", color: colorFor(me?._id ?? "me") },
        }),
      ],
      editorProps: {
        attributes: { class: "nutshell-doc", "aria-label": `Document: ${loaded.note.name}` },
        handleKeyDown: (_view, event) => pickerKeys.current?.(event) ?? false,
        handleClickOn: (_view, _pos, node, nodePos, event) => {
          if (node.type.name !== "pageLink") return false
          event.preventDefault()
          followLink.current(node.attrs.id, node.attrs.name, nodePos)
          return true
        },
        // The link is a real <a> so it can be opened in a new tab; a plain click stays in the app.
        handleDOMEvents: {
          click: (_view, event) => {
            const link = (event.target as HTMLElement).closest?.("a[data-page-link]")
            if (link && !event.ctrlKey && !event.metaKey) event.preventDefault()
            return false
          },
        },
      },
    },
    [provider]
  )

  // Connect once the editor is bound to the document, then follow the relay.
  useEffect(() => {
    if (!editor) return
    const offs = [
      provider.on("status", setStatus),
      // Once connected, the relay's answer (from your folder role) decides.
      provider.on("readOnly", setReadOnly),
      provider.on("rejected", () => toast.error("That change is too large to sync. Others won't see it; try splitting it up.")),
      // Exactly one browser loads the saved markdown into an empty live page.
      provider.on("seed", () => {
        if (loaded.body.trim()) editor.commands.setContent(loaded.body, { contentType: "markdown" })
      }),
    ]
    provider.doc.on("update", () => {
      dirty.current = true
    })
    void provider.connect()
    return () => offs.forEach((off) => off())
  }, [editor, provider, loaded.body, loaded.canEdit])

  // Live editing off (switched off or unavailable): edit the saved markdown directly.
  useEffect(() => {
    if (!editor || status !== "off") return
    editor.commands.setContent(loaded.body, { contentType: "markdown" })
    dirty.current = false
  }, [editor, status, loaded.body])

  useEffect(() => {
    editor?.setEditable(!readOnly)
  }, [editor, readOnly])

  // Go to a linked page; a link with no page yet makes one here (or finds it by name) first.
  useEffect(() => {
    followLink.current = (id, name, pos) => {
      void (async () => {
        let target = id
        try {
          if (!target && name.length >= 2) {
            const { items } = await foldersApi.search(name, "note")
            target = items.find((item) => item.name.toLowerCase() === name.toLowerCase())?.id ?? null
          }
          if (!target) {
            if (readOnly) return void toast.error(`There's no page called “${name}” yet`)
            target = (await foldersApi.createNote(loaded.note.id, name, "")).id
          }
          // Remember which page it is, so a later rename doesn't break the link.
          if (!readOnly && !id && editor && editor.state.doc.nodeAt(pos)?.type.name === "pageLink") {
            editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { id: target, name }))
          }
          router.push(`/docs/${encodeURIComponent(target)}`)
        } catch (error) {
          toast.error(explain(error))
        }
      })()
    }
  }, [editor, readOnly, loaded.note.id, router])

  useEffect(() => {
    if (!editor) return
    setPaperLayout(editor, view === "pages" ? { contentHeight: sheet.height - MARGIN * 2, gap: MARGIN * 2 + SHEET_GAP, onPages: setPages } : null)
  }, [editor, view, sheet.height])

  const save = useCallback(
    async (reason?: string) => {
      if (!editor) return
      setSaving(true)
      try {
        let current = note
        try {
          current = await foldersApi.updateNote(current, editor.getMarkdown(), reason)
        } catch (error) {
          // Someone else (or an agent) saved first: base on the newest version and try once more.
          if (!(error instanceof FoldersError && error.code === "version_conflict")) throw error
          const fresh = await foldersApi.readNote(note.id)
          current = await foldersApi.updateNote(fresh.note, editor.getMarkdown(), reason)
        }
        setNote(current)
        dirty.current = false
        if (!reason) toast.success("Saved a new version")
      } catch (error) {
        toast.error(explain(error))
      } finally {
        setSaving(false)
      }
    },
    [editor, note]
  )

  // One browser in the room writes an autosave version every couple of minutes while there are changes.
  useEffect(() => {
    if (!live || readOnly) return
    const timer = setInterval(() => {
      if (dirty.current && provider.isSaver()) void save("autosave")
    }, AUTOSAVE_MS)
    return () => clearInterval(timer)
  }, [live, readOnly, provider, save])

  return (
    <div className={cn("mx-auto flex w-full flex-col gap-4 px-6 py-6", view === "pages" ? "max-w-[60rem]" : "max-w-3xl")}>
      {/* The size the browser's print dialog and Save as PDF use. */}
      <style>{`@page { size: ${sheet.css}; margin: 1in; }`}</style>
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        <Link href="/files" className="hover:underline">
          Folders
        </Link>
        {loaded.crumbs.map((crumb) => (
          <span key={crumb.id} className="flex items-center gap-1">
            <ChevronRightIcon className="size-3.5" aria-hidden="true" />
            {crumb.id === note.id ? (
              <span className="text-foreground">{crumb.name}</span>
            ) : (
              <Link href={crumb.id.startsWith("nte_") ? `/docs/${encodeURIComponent(crumb.id)}` : `/files?folder=${encodeURIComponent(crumb.id)}`} className="hover:underline">
                {crumb.name}
              </Link>
            )}
          </span>
        ))}
      </nav>
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 flex-1 truncate text-2xl font-semibold">{note.name}</h1>
        <div className="flex items-center gap-2" aria-live="polite">
          {readOnly ? (
            <Badge variant="outline">
              <LockIcon aria-hidden="true" /> View only
            </Badge>
          ) : null}
          {status === "live" ? (
            <Badge variant="outline">
              <WifiIcon aria-hidden="true" /> Live
            </Badge>
          ) : status === "reconnecting" ? (
            <Badge variant="outline">
              <WifiOffIcon aria-hidden="true" /> Reconnecting… your edits are kept
            </Badge>
          ) : status === "off" ? (
            <Badge variant="outline">Editing alone</Badge>
          ) : (
            <Badge variant="outline">Connecting…</Badge>
          )}
          {!readOnly ? (
            <Button size="sm" variant="outline" disabled={saving} onClick={() => void save()}>
              Save version
            </Button>
          ) : null}
        </div>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <p className="text-xs text-muted-foreground">
          Version {note.current_version}
          {live && !readOnly ? " · saves a version automatically every few minutes" : ""}
          {" · "}hover a button to see its shortcut
        </p>
        <div className="flex items-center gap-2">
          <ToggleGroup type="single" variant="outline" size="sm" value={view} onValueChange={(value) => value && chooseView(value as "flow" | "pages")} aria-label="Page layout">
            <ToggleGroupItem value="flow">Continuous</ToggleGroupItem>
            <ToggleGroupItem value="pages">Pages</ToggleGroupItem>
          </ToggleGroup>
          {view === "pages" && (
            <Select value={size} onValueChange={(value) => chooseSize(value as SheetSize)}>
              <SelectTrigger size="sm" aria-label="Paper size" className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SHEETS) as SheetSize[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {SHEETS[key].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <PrinterIcon data-icon="inline-start" aria-hidden="true" />
            Print / PDF
          </Button>
        </div>
      </div>
      {editor && !readOnly ? <EditorToolbar editor={editor} /> : null}
      {view === "pages" ? (
        // Gray desk, white sheets: the sheets are painted behind one continuous editor.
        <div className="overflow-x-auto rounded-lg bg-muted p-4">
          <div
            className="nutshell-print-root nutshell-paper mx-auto shadow-sm"
            style={
              {
                width: sheet.width,
                minHeight: pages * sheet.height + (pages - 1) * SHEET_GAP,
                padding: MARGIN,
                "--nutshell-sheet": `${sheet.height}px`,
                "--nutshell-sheet-gap": `${SHEET_GAP}px`,
              } as React.CSSProperties
            }
          >
            {editor ? <EditorContent editor={editor} /> : <EditorSkeleton />}
          </div>
        </div>
      ) : (
        <div className="nutshell-print-root rounded-lg border bg-background px-6 py-5">{editor ? <EditorContent editor={editor} /> : <EditorSkeleton />}</div>
      )}
      {editor && !readOnly ? <PagePicker editor={editor} currentId={note.id} keysRef={pickerKeys} /> : null}
      <Backlinks documentId={note.id} />
    </div>
  )
}

function EditorSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-6">
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  )
}
