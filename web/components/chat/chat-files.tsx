"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { nodeSize } from "@/components/files/file-panels"
import { FilesSearch } from "@/components/files/files-search"
import { NodeIcon } from "@/components/files/thumbnail"
import { CheckIcon, ChevronLeftIcon, Loader2Icon, LockIcon, PaperclipIcon, RefreshCwIcon, XIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { ChatAttachment } from "@/lib/chat-api"
import { AttachmentDirectory, uploadToChannel } from "@/lib/chat-files"
import { type Folder, FoldersError, foldersApi, ROOT } from "@/lib/folders-api"
import { cn } from "@/lib/utils"

export const MAX_ATTACHMENTS = 10

const DirectoryContext = createContext<AttachmentDirectory | null>(null)

export function AttachmentsProvider({ children }: { children: React.ReactNode }) {
  const [directory] = useState(() => new AttachmentDirectory())
  return <DirectoryContext.Provider value={directory}>{children}</DirectoryContext.Provider>
}

const chip = "inline-flex h-8 max-w-full items-center gap-1.5 rounded-md border bg-background px-2 text-xs"

function explain(caught: unknown) {
  return caught instanceof FoldersError ? caught.message : "Something went wrong. Try again."
}

// -- in a message ------------------------------------------------------------------

export function MessageAttachments({ attachments }: { attachments: ChatAttachment[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5 pt-1" aria-label="Attached files">
      {attachments.map((item) => (
        <li key={`${item.file_id}@${item.version}`} className="max-w-full">
          <AttachmentChip item={item} />
        </li>
      ))}
    </ul>
  )
}

function AttachmentChip({ item }: { item: ChatAttachment }) {
  const directory = useContext(DirectoryContext)
  if (!directory) throw new Error("AttachmentChip needs an AttachmentsProvider")
  const router = useRouter()
  useSyncExternalStore(directory.subscribe, directory.snapshot, () => 0)
  const state = directory.get(item)
  const [opening, setOpening] = useState(false)

  useEffect(() => directory.want(item), [directory, item])

  if (state.status === "checking") {
    return (
      <span className={cn(chip, "text-muted-foreground")}>
        <Loader2Icon className="size-3.5 motion-safe:animate-spin" aria-hidden="true" /> Checking file
      </span>
    )
  }
  if (state.status === "failed") {
    return (
      <button type="button" className={cn(chip, "text-muted-foreground hover:bg-muted")} onClick={() => directory.want(item, true)}>
        <RefreshCwIcon className="size-3.5" aria-hidden="true" /> Couldn&apos;t check this file. Try again
      </button>
    )
  }
  const { file } = state
  if (!file.available) {
    return (
      <span className={cn(chip, "text-muted-foreground")}>
        <LockIcon className="size-3.5" aria-hidden="true" /> You don&apos;t have access to this file
      </span>
    )
  }

  // Asks Files as this viewer each time: what it said a few minutes ago may no longer hold.
  const open = async () => {
    if (file.type === "note") return router.push(`/docs/${encodeURIComponent(file.file_id)}`)
    if (file.type === "whiteboard") return router.push(`/boards/${encodeURIComponent(file.file_id)}`)
    setOpening(true)
    try {
      const { url } = await foldersApi.link(file.file_id, item.version)
      window.location.assign(url) // served as an attachment, never rendered from the bucket
    } catch (caught) {
      const gone = caught instanceof FoldersError && (caught.status === 403 || caught.status === 404)
      toast.error("Couldn't open that file", { description: gone ? "It may have been moved to the trash, or you may no longer have access." : explain(caught) })
      directory.want(item, true)
    } finally {
      setOpening(false)
    }
  }

  const older = file.current_version !== undefined && file.current_version > item.version
  return (
    <button type="button" className={cn(chip, "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none")} title={file.name} disabled={opening} onClick={() => void open()}>
      {opening ? <Loader2Icon className="size-3.5 motion-safe:animate-spin" aria-hidden="true" /> : <NodeIcon node={{ type: file.type ?? "file" }} className="size-3.5" />}
      <span className="max-w-56 truncate font-medium">{file.name}</span>
      {file.size !== undefined && file.type === "file" ? <span className="shrink-0 text-muted-foreground">{nodeSize(file.size)}</span> : null}
      {older ? <span className="shrink-0 text-muted-foreground">version {item.version}, newer exists</span> : null}
    </button>
  )
}

// -- in the composer -----------------------------------------------------------------

type Draft = { key: string; name: string; status: string | null; attachment?: { file_id: string; version?: number } }

/** What the composer has picked or is uploading. Uploads run one at a time. */
export function useComposerFiles(channelId: string, onChange: () => void) {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const nextKey = useRef(0)
  const newKey = () => `draft-${(nextKey.current += 1)}`
  const queue = useRef(Promise.resolve())

  const patch = useCallback((key: string, fields: Partial<Draft>) => {
    setDrafts((current) => current.map((draft) => (draft.key === key ? { ...draft, ...fields } : draft)))
  }, [])

  const remove = useCallback(
    (key: string) => {
      setDrafts((current) => current.filter((draft) => draft.key !== key))
      onChange()
    },
    [onChange]
  )

  const upload = (files: File[]) => {
    const room = MAX_ATTACHMENTS - drafts.length
    if (files.length > room) toast.error(`A message can have up to ${MAX_ATTACHMENTS} files`)
    for (const file of files.slice(0, Math.max(room, 0))) {
      const key = newKey()
      setDrafts((current) => [...current, { key, name: file.name, status: "Waiting" }])
      queue.current = queue.current.then(async () => {
        try {
          const done = await uploadToChannel(channelId, file, (status) => patch(key, { status }))
          patch(key, { status: null, name: done.name, attachment: { file_id: done.file_id, version: done.version } })
          onChange()
        } catch (caught) {
          toast.error(`Couldn't add ${file.name}`, { description: caught instanceof Error ? caught.message : undefined })
          setDrafts((current) => current.filter((draft) => draft.key !== key))
        }
      })
    }
  }

  const pick = (node: Folder) => {
    setDrafts((current) => {
      if (current.length >= MAX_ATTACHMENTS || current.some((draft) => draft.attachment?.file_id === node.id)) return current
      return [
        ...current,
        { key: newKey(), name: node.name, status: null, attachment: { file_id: node.id, ...(node.current_version ? { version: node.current_version } : {}) } },
      ]
    })
    onChange()
  }

  const ready = drafts.flatMap((draft) => (draft.attachment ? [draft.attachment] : []))
  return { drafts, ready, busy: drafts.some((draft) => draft.status !== null), upload, pick, remove, clear: () => setDrafts([]) }
}

export function ComposerDrafts({ drafts, onRemove }: { drafts: Draft[]; onRemove: (key: string) => void }) {
  if (!drafts.length) return null
  return (
    <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Files to send">
      {drafts.map((draft) => (
        <li key={draft.key} className={cn(chip, "max-w-72")}>
          {draft.status ? <Loader2Icon className="size-3.5 shrink-0 motion-safe:animate-spin" aria-hidden="true" /> : <PaperclipIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
          <span className="truncate font-medium">{draft.name}</span>
          {draft.status ? <span className="shrink-0 text-muted-foreground">{draft.status}</span> : null}
          <button type="button" className="ml-0.5 shrink-0 rounded-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none" aria-label={`Remove ${draft.name}`} onClick={() => onRemove(draft.key)}>
            <XIcon className="size-3.5" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  )
}

export function AttachButton({ onUpload, onPick, chosen }: { onUpload: (files: File[]) => void; onPick: (node: Folder) => void; chosen: Set<string> }) {
  const input = useRef<HTMLInputElement>(null)
  const [browsing, setBrowsing] = useState(false)
  return (
    <>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        aria-label="Upload files"
        onChange={(event) => {
          onUpload([...(event.target.files ?? [])])
          event.target.value = ""
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Attach a file">
            <PaperclipIcon aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => input.current?.click()}>Upload from this device</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setBrowsing(true)}>Choose from Folders</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <FolderPicker key={browsing ? "open" : "closed"} open={browsing} chosen={chosen} onPick={onPick} onClose={() => setBrowsing(false)} />
    </>
  )
}

function FolderPicker({ open, chosen, onPick, onClose }: { open: boolean; chosen: Set<string>; onPick: (node: Folder) => void; onClose: () => void }) {
  const [path, setPath] = useState<{ id: string; name: string }[]>([])
  const folder = path.at(-1)?.id ?? ROOT
  const [listing, setListing] = useState<{ folder: string; items: Folder[]; cursor: string | null } | null>(null)
  const [failure, setFailure] = useState<{ folder: string; message: string } | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    foldersApi
      .children(folder)
      .then((page) => {
        if (!cancelled) setListing({ folder, items: page.items, cursor: page.next_cursor })
      })
      .catch((caught) => {
        if (!cancelled) setFailure({ folder, message: explain(caught) })
      })
    return () => {
      cancelled = true
    }
  }, [open, folder])

  const more = async () => {
    if (!listing?.cursor) return
    try {
      const page = await foldersApi.children(folder, listing.cursor)
      setListing((current) => (current && current.folder === folder ? { folder, items: [...current.items, ...page.items], cursor: page.next_cursor } : current))
    } catch (caught) {
      toast.error(explain(caught))
    }
  }

  const shown = listing?.folder === folder ? listing : null
  const error = failure?.folder === folder ? failure.message : ""

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Choose from Folders</DialogTitle>
          <DialogDescription>People who can&apos;t open a file in Folders will see that they don&apos;t have access to it.</DialogDescription>
        </DialogHeader>
        <FilesSearch
          label="Search files by name"
          onPick={(hit) => {
            if (hit.type === "folder") setPath((current) => [...current, { id: hit.id, name: hit.name }])
            else onPick(hit)
          }}
        />
        <div className="flex h-8 items-center gap-1 text-sm">
          {path.length ? (
            <Button variant="ghost" size="icon-sm" aria-label="Up a folder" onClick={() => setPath((current) => current.slice(0, -1))}>
              <ChevronLeftIcon aria-hidden="true" />
            </Button>
          ) : null}
          <span className="truncate font-medium">{path.at(-1)?.name ?? "All folders"}</span>
        </div>
        <ul className="h-64 overflow-y-auto rounded-md border p-1">
          {error ? (
            <li className="px-2 py-1.5 text-sm text-muted-foreground">{error}</li>
          ) : !shown ? (
            <li className="px-2 py-1.5 text-sm text-muted-foreground">Loading…</li>
          ) : !shown.items.length ? (
            <li className="px-2 py-1.5 text-sm text-muted-foreground">Nothing here.</li>
          ) : (
            shown.items.map((node) => (
              <li key={node.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                  onClick={() => (node.type === "folder" ? setPath((current) => [...current, { id: node.id, name: node.name }]) : onPick(node))}
                >
                  <NodeIcon node={node} />
                  <span className="truncate">{node.name}</span>
                  {chosen.has(node.id) ? <CheckIcon className="ml-auto size-4 shrink-0" aria-label="Added" /> : null}
                </button>
              </li>
            ))
          )}
          {shown?.cursor ? (
            <li>
              <Button variant="ghost" size="sm" className="w-full" onClick={() => void more()}>
                Show more
              </Button>
            </li>
          ) : null}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
