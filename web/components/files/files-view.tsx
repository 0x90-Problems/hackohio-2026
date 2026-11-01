"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { ActorBadge } from "@/components/actor-badge"
import {
  ArchiveIcon,
  ArrowRightIcon,
  FileIcon,
  FileTextIcon,
  FolderIcon,
  HistoryIcon,
  PenToolIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "@/components/icons"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { timeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"
import { type Crumb, type Folder, FoldersError, foldersApi, ROOT, type Workspace } from "@/lib/folders-api"
import { FilePanel, NoteDialog, nodeSize } from "@/components/files/file-panels"
import { ExplorerView } from "@/components/files/explorer"
import { TeamSwitcher } from "@/components/team-switcher"
import { Thumbnail } from "@/components/files/thumbnail"
import { FilesSearch } from "@/components/files/files-search"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useWhiteboardEnabled } from "@/lib/whiteboard-api"

type Dialogs =
  | { kind: "create" }
  | { kind: "note"; node?: Folder }
  | { kind: "board" }
  | { kind: "document" }
  | { kind: "file"; node: Folder }
  | { kind: "rename"; folder: Folder }
  | { kind: "move"; folder: Folder }
  | { kind: "trash"; folder: Folder }
  | null

function explain(error: unknown) {
  if (error instanceof FoldersError) return error.message
  return "Something went wrong. Try again."
}

const canEdit = (role?: Folder["role"]) => role === "editor" || role === "manager"

const MODE_KEY = "nutshell.files.mode"

// The last layout this browser used (a per-viewer convenience; the URL wins).
function storedMode(): string | null {
  try {
    return typeof window === "undefined" ? null : localStorage.getItem(MODE_KEY)
  } catch {
    return null
  }
}

type View =
  | { kind: "off" }
  | { kind: "error"; message: string }
  | { kind: "ready"; workspace: Workspace; items: Folder[]; role: Folder["role"]; cursor: string | null; crumbs: Crumb[] }

// Fetch everything one view needs. No state here, so the effect can ignore
// a response that arrives after the user has navigated elsewhere.
async function fetchView(folderId: string, showTrash: boolean): Promise<View> {
  try {
    if (!(await foldersApi.enabled())) return { kind: "off" }
    const workspace = await foldersApi.workspace()
    if (showTrash) {
      const trash = await foldersApi.listTrash()
      return { kind: "ready", workspace, items: trash.items, role: undefined, cursor: null, crumbs: [] }
    }
    const [page, path] = await Promise.all([
      foldersApi.children(folderId),
      folderId === ROOT ? Promise.resolve({ items: [] as Crumb[] }) : foldersApi.path(folderId),
    ])
    return { kind: "ready", workspace, items: page.items, role: page.role, cursor: page.next_cursor, crumbs: path.items }
  } catch (error) {
    return { kind: "error", message: explain(error) }
  }
}

// "just now", or "6 min ago" / "2 h ago".
function ago(iso?: string) {
  if (!iso) return ""
  const text = timeAgo(new Date(iso))
  return text === "just now" ? text : `${text} ago`
}

// Team folders: one tree per team. The URL's ?folder= keeps the place on reload.
export function FilesView() {
  const router = useRouter()
  const whiteboardOn = useWhiteboardEnabled()
  const params = useSearchParams()
  const folderId = params.get("folder") || ROOT
  const showTrash = params.get("view") === "trash"
  // Two layouts over the same data: cards (grid) or tree + list + preview (explorer).
  // Explorer is the default; ?mode=grid (or this browser's last choice) switches to cards.
  const mode: "grid" | "explorer" = (params.get("mode") ?? storedMode()) === "grid" ? "grid" : "explorer"

  const [state, setState] = useState<"off" | "ready" | "error">("ready")
  // Which view the data on screen belongs to; anything else is still loading.
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const viewKey = `${folderId}|${showTrash ? "trash" : "folders"}`
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [items, setItems] = useState<Folder[]>([])
  const [role, setRole] = useState<Folder["role"]>()
  const [crumbs, setCrumbs] = useState<Crumb[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [message, setMessage] = useState("")
  const [dialog, setDialog] = useState<Dialogs>(null)
  const fileInput = useRef<HTMLInputElement>(null)



  const go = useCallback(
    (next: { folder?: string; view?: "trash"; mode?: "grid" | "explorer" }) => {
      const search = new URLSearchParams()
      if (next.folder && next.folder !== ROOT) search.set("folder", next.folder)
      if (next.view) search.set("view", next.view)
      const nextMode = next.mode ?? mode
      if (nextMode === "grid") search.set("mode", "grid")
      const query = search.toString()
      router.push(query ? `/files?${query}` : "/files")
    },
    [router, mode]
  )

  function setMode(next: "grid" | "explorer") {
    try {
      localStorage.setItem(MODE_KEY, next)
    } catch {
      // private window or blocked storage: the URL still carries the mode
    }
    go({ folder: folderId, ...(showTrash ? { view: "trash" as const } : {}), mode: next })
  }

  // The same actions in both layouts.
  function actionsFor(folder: Folder) {
    if (showTrash) {
      return canEdit(folder.role) ? (
        <Button
          variant="outline"
          size="sm"
          className="relative z-10"
          onClick={() => void run(() => foldersApi.restore(folder), `Restored ${folder.name}`)}
        >
          <HistoryIcon data-icon="inline-start" aria-hidden="true" />
          Restore
        </Button>
      ) : null
    }
    if (!canEdit(folder.role)) return null
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative z-10 size-8" aria-label={`Actions for ${folder.name}`}>
            <MoreHorizontalIcon aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setDialog({ kind: "rename", folder })}>
            <PencilIcon aria-hidden="true" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog({ kind: "move", folder })}>
            <ArrowRightIcon aria-hidden="true" />
            Move
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDialog({ kind: "trash", folder })}>
            <ArchiveIcon aria-hidden="true" />
            Move to trash
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  const openNode = (node: Folder) => {
    if (node.type === "whiteboard") return router.push(`/boards/${encodeURIComponent(node.id)}`)
    // Documents open in the full-page editor.
    if (node.type === "note") return router.push(`/docs/${encodeURIComponent(node.id)}`)
    setDialog(node.type === "file" ? { kind: "file", node } : null)
  }

  // Apply a fetched view, unless the user has already moved on to another one.
  const apply = useCallback((key: string, view: View) => {
    if (view.kind === "ready") {
      setWorkspace(view.workspace)
      setItems(view.items)
      setRole(view.role)
      setCursor(view.cursor)
      setCrumbs(view.crumbs)
    }
    if (view.kind === "error") setMessage(view.message)
    setState(view.kind)
    setLoadedFor(key)
  }, [])

  const load = useCallback(
    () => fetchView(folderId, showTrash).then((view) => apply(viewKey, view)),
    [folderId, showTrash, viewKey, apply]
  )

  async function uploadNew(file: File) {
    const toastId = toast.loading(`Uploading ${file.name}…`)
    try {
      await foldersApi.upload(file, { parentId: folderId }, (status) => toast.loading(`${status} ${file.name}…`, { id: toastId }))
      toast.success(`Added ${file.name}`, { id: toastId, description: "It passed the security scan." })
      await load()
    } catch (error) {
      toast.error(`Couldn't add ${file.name}`, { id: toastId, description: explain(error) })
    }
  }
  useEffect(() => {
    let cancelled = false
    void fetchView(folderId, showTrash).then((view) => {
      if (!cancelled) apply(viewKey, view)
    })
    return () => {
      cancelled = true
    }
  }, [folderId, showTrash, viewKey, apply])

  const phase = loadedFor === viewKey ? state : "loading"
  // Moving between folders keeps the page in place; only the list itself reloads.
  const showPage = phase === "ready" || (phase === "loading" && workspace !== null)

  async function loadMore() {
    if (!cursor) return
    try {
      const page = await foldersApi.children(folderId, cursor)
      setItems((current) => [...current, ...page.items])
      setCursor(page.next_cursor)
    } catch (error) {
      toast.error("Couldn't load more folders", { description: explain(error) })
    }
  }

  // Every write returns the folder's new rev; a 409 means someone changed it first.
  async function run(action: () => Promise<unknown>, done: string) {
    try {
      await action()
      toast.success(done)
      setDialog(null)
      await load()
    } catch (error) {
      const stale = error instanceof FoldersError && error.code === "rev_conflict"
      toast.error(stale ? "Someone changed this folder first" : "Couldn't save", {
        description: stale ? "The list has been refreshed. Try again." : explain(error),
      })
      if (stale) await load()
    }
  }

  const emptyText = showTrash ? "The trash is empty." : canEdit(role) ? "Nothing here yet. Create or upload something to get started." : "Nothing here yet."

  return (
    <main className={cn("mx-auto flex flex-col gap-6 px-4 py-6", mode === "explorer" ? "max-w-screen-2xl" : "max-w-screen-xl")}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
            <FolderIcon className="size-6" aria-hidden="true" />
            Folders
          </h1>
          <p className="text-muted-foreground">
            {workspace ? `${workspace.team_name}'s shared folders.` : "Your team's shared folders."}
          </p>
        </div>
        {showPage && (
          <div className="flex flex-wrap gap-2">
            <TeamSwitcher />
            {!showTrash && (
              <FilesSearch
                onPick={(hit) => (hit.type === "folder" ? go({ folder: hit.id }) : (go({ folder: hit.parent_id ?? ROOT }), openNode(hit)))}
              />
            )}
            <ToggleGroup
              type="single"
              variant="outline"
              value={mode}
              onValueChange={(value) => value && setMode(value as "grid" | "explorer")}
              aria-label="Layout"
            >
              <ToggleGroupItem value="explorer" aria-label="Explorer">
                Explorer
              </ToggleGroupItem>
              <ToggleGroupItem value="grid" aria-label="Grid">
                Grid
              </ToggleGroupItem>
            </ToggleGroup>
            <Button variant="outline" onClick={() => go(showTrash ? { folder: ROOT } : { view: "trash" })}>
              {showTrash ? <FolderIcon data-icon="inline-start" aria-hidden="true" /> : <Trash2Icon data-icon="inline-start" aria-hidden="true" />}
              {showTrash ? "Back to folders" : "Trash"}
            </Button>
            {!showTrash && canEdit(role) && (
              <>
                <input
                  ref={fileInput}
                  type="file"
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(event) => {
                    const picked = event.target.files?.[0]
                    event.target.value = ""
                    if (picked) void uploadNew(picked)
                  }}
                />
                <Button variant="outline" onClick={() => fileInput.current?.click()}>
                  <FileIcon data-icon="inline-start" aria-hidden="true" />
                  Upload
                </Button>
                <Button variant="outline" onClick={() => setDialog({ kind: "document" })}>
                  <FileTextIcon data-icon="inline-start" aria-hidden="true" />
                  New document
                </Button>
                {whiteboardOn ? (
                  <Button variant="outline" onClick={() => setDialog({ kind: "board" })}>
                    <PenToolIcon data-icon="inline-start" aria-hidden="true" />
                    New board
                  </Button>
                ) : null}
                <Button onClick={() => setDialog({ kind: "create" })}>
                  <PlusIcon data-icon="inline-start" aria-hidden="true" />
                  New folder
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {showPage && !showTrash && (
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              {crumbs.length === 0 ? (
                <BreadcrumbPage>All folders</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href="/files">All folders</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {crumbs.map((crumb, index) => (
              <span key={crumb.id} className="contents">
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {index === crumbs.length - 1 ? (
                    <BreadcrumbPage>{crumb.name}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={`/files?folder=${encodeURIComponent(crumb.id)}`}>{crumb.name}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </span>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      )}

      {phase === "loading" && mode === "grid" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading folders">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      )}

      {phase === "off" && (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">Folders are coming soon</p>
          <p className="mt-1 text-sm text-muted-foreground">They&apos;re built but not switched on yet.</p>
        </div>
      )}

      {phase === "error" && (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border p-10 text-center">
          <p className="font-medium">Couldn&apos;t open this folder</p>
          <p className="text-sm text-muted-foreground">{message}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void load()}>
              Try again
            </Button>
            <Button variant="outline" asChild>
              <Link href="/files">All folders</Link>
            </Button>
          </div>
        </div>
      )}

      {phase === "ready" && items.length === 0 && mode === "grid" && (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">{emptyText}</div>
      )}

      {(phase === "ready" || phase === "loading") && mode === "explorer" && (
        <ExplorerView
          items={items}
          loading={phase === "loading"}
          emptyText={emptyText}
          folderId={folderId}
          crumbs={crumbs}
          rootLabel={workspace?.team_name ?? "All folders"}
          showTrash={showTrash}
          onOpenFolder={(id) => go({ folder: id })}
          onOpen={openNode}
          actions={actionsFor}
        />
      )}

      {phase === "ready" && items.length > 0 && mode === "grid" && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((folder) => (
            <li
              key={folder.id}
              className="group relative flex flex-col gap-3 rounded-xl border bg-card p-4 transition-shadow hover:-translate-y-0.5 hover:shadow-md motion-safe:transition-transform motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
            >
              {/* Every card gets one, so a row of cards lines up. */}
              {!showTrash && <Thumbnail node={folder} variant="card" />}
              <div className="flex items-start gap-3">
              {folder.type === "note" ? (
                <FileTextIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              ) : folder.type === "whiteboard" ? (
                <PenToolIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              ) : folder.type === "file" ? (
                <FileIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              ) : (
                <FolderIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                {showTrash ? (
                  <span className="truncate font-medium">{folder.name}</span>
                ) : folder.type !== "folder" ? (
                  <button
                    type="button"
                    onClick={() => openNode(folder)}
                    className="truncate text-left font-medium after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
                  >
                    {folder.name}
                  </button>
                ) : (
                  <Link
                    href={`/files?folder=${encodeURIComponent(folder.id)}`}
                    className="truncate font-medium after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
                  >
                    {folder.name}
                  </Link>
                )}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  {(showTrash ? folder.deleted_by : folder.created_by) && (
                    <ActorBadge actor={(showTrash ? folder.deleted_by : folder.created_by)!} interactive={false} />
                  )}
                  <span>
                    {showTrash ? "Trashed" : "Updated"} {ago(showTrash ? folder.deleted_at : folder.updated_at)}
                  </span>
                  {folder.type !== "folder" && folder.current_version && (
                    <span>
                      v{folder.current_version}
                      {folder.size !== undefined ? ` · ${nodeSize(folder.size)}` : ""}
                    </span>
                  )}
                  {folder.acl_mode === "restricted" && <span className="rounded border px-1">Restricted</span>}
                </div>
              </div>
              {actionsFor(folder)}
              </div>
            </li>
          ))}
        </ul>
      )}

      {phase === "ready" && cursor && !showTrash && (
        <Button variant="outline" className="self-center" onClick={() => void loadMore()}>
          Load more
        </Button>
      )}

      <NameDialog
        open={dialog?.kind === "create" || dialog?.kind === "rename"}
        title={dialog?.kind === "rename" ? "Rename folder" : "New folder"}
        initial={dialog?.kind === "rename" ? dialog.folder.name : ""}
        submitLabel={dialog?.kind === "rename" ? "Rename" : "Create"}
        onClose={() => setDialog(null)}
        onSubmit={(name) =>
          dialog?.kind === "rename"
            ? run(() => foldersApi.rename(dialog.folder, name), `Renamed to ${name}`)
            : run(() => foldersApi.create(folderId, name), `Created ${name}`)
        }
      />

      <NameDialog
        open={dialog?.kind === "document"}
        title="New document"
        initial=""
        submitLabel="Create document"
        onClose={() => setDialog(null)}
        onSubmit={async (name) => {
          try {
            const created = await foldersApi.createNote(folderId, name, "")
            setDialog(null)
            router.push(`/docs/${encodeURIComponent(created.id)}`)
          } catch (error) {
            toast.error(explain(error))
          }
        }}
      />

      <NameDialog
        open={dialog?.kind === "board"}
        title="New board"
        initial=""
        submitLabel="Create board"
        onClose={() => setDialog(null)}
        onSubmit={async (name) => {
          try {
            const board = await foldersApi.createBoard(folderId, name)
            setDialog(null)
            router.push(`/boards/${encodeURIComponent(board.id)}`)
          } catch (error) {
            toast.error(explain(error))
          }
        }}
      />

      {dialog?.kind === "file" && (
        <FilePanel file={dialog.node} canEdit={canEdit(dialog.node.role)} onClose={() => setDialog(null)} onChanged={() => void load()} />
      )}
      {dialog?.kind === "note" && (
        <NoteDialog
          note={dialog.node}
          parentId={folderId}
          canEdit={dialog.node ? canEdit(dialog.node.role) : canEdit(role)}
          onClose={() => setDialog(null)}
          onChanged={() => void load()}
        />
      )}

      {dialog?.kind === "move" && (
        <MoveDialog folder={dialog.folder} onClose={() => setDialog(null)} onMove={(target, label) => run(() => foldersApi.move(dialog.folder, target), `Moved to ${label}`)} />
      )}

      <Dialog open={dialog?.kind === "trash"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move “{dialog?.kind === "trash" ? dialog.folder.name : ""}” to the trash?</DialogTitle>
            <DialogDescription>Everything inside goes with it. You can restore it from the trash at any time.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => dialog?.kind === "trash" && void run(() => foldersApi.trash(dialog.folder), `Moved ${dialog.folder.name} to the trash`)}
            >
              Move to trash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function NameDialog({
  open,
  title,
  initial,
  submitLabel,
  onClose,
  onSubmit,
}: {
  open: boolean
  title: string
  initial: string
  submitLabel: string
  onClose: () => void
  onSubmit: (name: string) => Promise<void>
}) {
  const [name, setName] = useState(initial)
  const [busy, setBusy] = useState(false)
  // Reset the field each time the dialog opens.
  const [lastOpen, setLastOpen] = useState(open)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) setName(initial)
  }
  const trimmed = name.trim()
  const invalid = trimmed.length > 120 || /[\\/]/.test(trimmed) || trimmed === "." || trimmed === ".."

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault()
            if (!trimmed || invalid) return
            setBusy(true)
            await onSubmit(trimmed)
            setBusy(false)
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="folder-name">Name</Label>
            <Input
              id="folder-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
              required
              maxLength={120}
              aria-invalid={invalid || undefined}
              aria-describedby={invalid ? "folder-name-error" : undefined}
            />
            {invalid && (
              <p id="folder-name-error" className="text-sm text-destructive">
                Names can&apos;t contain / or \, or be . or ..
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!trimmed || invalid || busy}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Pick a destination by browsing the tree. The folder being moved (and so its
// subfolders) can't be chosen; the API also rejects cycles.
function MoveDialog({
  folder,
  onClose,
  onMove,
}: {
  folder: Folder
  onClose: () => void
  onMove: (target: string, label: string) => Promise<void>
}) {
  const [at, setAt] = useState<Crumb[]>([])
  const [options, setOptions] = useState<Folder[] | null>(null)
  const current = at.at(-1)?.id ?? ROOT
  const label = at.at(-1)?.name ?? "All folders"

  useEffect(() => {
    let cancelled = false
    foldersApi
      .children(current)
      .then((page) => {
        if (!cancelled) setOptions(page.items.filter((item) => item.type === "folder" && item.id !== folder.id))
      })
      .catch(() => {
        if (!cancelled) setOptions([])
      })
    return () => {
      cancelled = true
    }
  }, [current, folder.id])

  const sameParent = current === (folder.parent_id ?? ROOT)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move “{folder.name}”</DialogTitle>
          <DialogDescription>Open a folder, then move “{folder.name}” into it.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-1 text-sm">
          <button type="button" className="hover:underline" onClick={() => setAt([])}>
            All folders
          </button>
          {at.map((crumb, index) => (
            <span key={crumb.id} className="flex items-center gap-1">
              <span aria-hidden="true">/</span>
              <button type="button" className="hover:underline" onClick={() => setAt(at.slice(0, index + 1))}>
                {crumb.name}
              </button>
            </span>
          ))}
        </div>
        <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-lg border p-1" aria-label="Folders">
          {options === null && <Skeleton className="h-9" />}
          {options?.length === 0 && <li className="p-2 text-sm text-muted-foreground">No subfolders here.</li>}
          {options?.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => {
                  setOptions(null)
                  setAt([...at, { id: option.id, name: option.name }])
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <FolderIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                <span className="truncate">{option.name}</span>
              </button>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={sameParent} onClick={() => void onMove(current, label)}>
            Move here
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
