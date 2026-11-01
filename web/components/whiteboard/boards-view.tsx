"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { ActorBadge } from "@/components/actor-badge"
import { FilesSearch } from "@/components/files/files-search"
import { Thumbnail } from "@/components/files/thumbnail"
import { PenToolIcon, PlusIcon } from "@/components/icons"
import { TeamSwitcher } from "@/components/team-switcher"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { timeAgo } from "@/lib/format"
import { type Folder, FoldersError, foldersApi, ROOT } from "@/lib/folders-api"
import { whiteboardEnabled } from "@/lib/whiteboard-api"

type Board = Folder & { path?: string[] }
type View = { kind: "loading" } | { kind: "off" } | { kind: "error"; message: string } | { kind: "ready"; boards: Board[] }

function explain(error: unknown) {
  return error instanceof FoldersError ? error.message : "Something went wrong. Try again."
}

async function fetchBoards(): Promise<View> {
  try {
    if (!(await whiteboardEnabled())) return { kind: "off" }
    const { items } = await foldersApi.search("", "whiteboard")
    return { kind: "ready", boards: items }
  } catch (error) {
    return { kind: "error", message: explain(error) }
  }
}

// Every whiteboard you can see, whichever folder it's kept in. Boards are still stored in
// Folders, so their permissions, moves and trash all work from there.
export function BoardsView() {
  const router = useRouter()
  const [view, setView] = useState<View>({ kind: "loading" })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetchBoards().then((next) => {
      if (!cancelled) setView(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const openBoard = (id: string) => router.push(`/boards/${encodeURIComponent(id)}`)

  return (
    <main className="mx-auto flex max-w-screen-xl flex-col gap-6 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
            <PenToolIcon className="size-6" aria-hidden="true" />
            Whiteboards
          </h1>
          <p className="text-muted-foreground">Draw live with people and agents.</p>
        </div>
        {view.kind === "ready" && (
          <div className="flex flex-wrap gap-2">
            <TeamSwitcher />
            <FilesSearch type="whiteboard" label="Search whiteboards" onPick={(hit) => openBoard(hit.id)} />
            <Button onClick={() => setCreating(true)}>
              <PlusIcon data-icon="inline-start" aria-hidden="true" />
              New board
            </Button>
          </div>
        )}
      </div>

      {view.kind === "loading" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading whiteboards">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      )}

      {view.kind === "off" && (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">Whiteboards are switched off right now</p>
          <p className="mt-1 text-sm text-muted-foreground">Your boards are safe. Check back soon.</p>
        </div>
      )}

      {view.kind === "error" && (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border p-10 text-center">
          <p className="font-medium">Couldn&apos;t load your whiteboards</p>
          <p className="text-sm text-muted-foreground">{view.message}</p>
          <Button variant="outline" onClick={() => void fetchBoards().then(setView)}>
            Try again
          </Button>
        </div>
      )}

      {view.kind === "ready" && view.boards.length === 0 && (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">No whiteboards yet. Create one to get started.</div>
      )}

      {view.kind === "ready" && view.boards.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {view.boards.map((board) => (
            <BoardCard key={board.id} board={board} />
          ))}
        </ul>
      )}

      {creating && <NewBoardDialog onClose={() => setCreating(false)} onCreated={openBoard} />}
    </main>
  )
}

function BoardCard({ board }: { board: Board }) {
  const updated = board.updated_at ? timeAgo(new Date(board.updated_at)) : ""
  const folder = board.parent_id && board.parent_id !== ROOT ? `/files?folder=${encodeURIComponent(board.parent_id)}` : "/files"
  return (
    <li className="group relative flex flex-col gap-3 rounded-xl border bg-card p-4 transition-shadow hover:-translate-y-0.5 hover:shadow-md motion-safe:transition-transform motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      <Thumbnail node={board} variant="card" />
      <div className="flex min-w-0 flex-col gap-1.5">
        <Link
          href={`/boards/${encodeURIComponent(board.id)}`}
          className="truncate font-medium after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
        >
          {board.name}
        </Link>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {board.created_by?.id && <ActorBadge actor={board.created_by} interactive={false} />}
          {updated && <span>Updated {updated === "just now" ? updated : `${updated} ago`}</span>}
        </div>
        <Link href={folder} className="relative z-10 w-fit max-w-full truncate text-xs text-muted-foreground hover:underline focus-visible:underline focus-visible:outline-none">
          In {board.path?.length ? board.path.join(" / ") : "Folders"}
        </Link>
      </div>
    </li>
  )
}

// A board has to live in a folder: the top level, or one of the folders right under it.
function NewBoardDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("")
  const [parent, setParent] = useState(ROOT)
  const [folders, setFolders] = useState<Folder[]>([])
  const [busy, setBusy] = useState(false)
  const trimmed = name.trim()
  const invalid = /[\\/]/.test(trimmed) || trimmed === "." || trimmed === ".."

  useEffect(() => {
    let cancelled = false
    foldersApi
      .children(ROOT)
      .then((page) => !cancelled && setFolders(page.items.filter((item) => item.type === "folder")))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  async function create(event: React.FormEvent) {
    event.preventDefault()
    if (!trimmed || invalid) return
    setBusy(true)
    try {
      onCreated((await foldersApi.createBoard(parent, trimmed)).id)
    } catch (error) {
      toast.error("Couldn't create the board", { description: explain(error) })
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <form className="flex flex-col gap-4" onSubmit={(event) => void create(event)}>
          <DialogHeader>
            <DialogTitle>New board</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="board-name">Name</Label>
            <Input
              id="board-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
              required
              maxLength={120}
              aria-invalid={invalid || undefined}
              aria-describedby={invalid ? "board-name-error" : undefined}
            />
            {invalid && (
              <p id="board-name-error" className="text-sm text-destructive">
                Names can&apos;t contain slashes, or be just dots.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="board-folder">Save in</Label>
            <Select value={parent} onValueChange={setParent}>
              <SelectTrigger id="board-folder" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ROOT}>All folders (top level)</SelectItem>
                {folders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {folder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !trimmed || invalid}>
              Create board
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
