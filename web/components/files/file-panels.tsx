"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { ActorBadge } from "@/components/actor-badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { absoluteTime } from "@/lib/format"
import { type Folder, FoldersError, foldersApi, type Version } from "@/lib/folders-api"

export function nodeSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function explain(error: unknown) {
  return error instanceof FoldersError ? error.message : "Something went wrong. Try again."
}

function useVersions(id: string | undefined, refresh: number) {
  const [versions, setVersions] = useState<Version[] | null>(null)
  useEffect(() => {
    if (!id) return
    let cancelled = false
    foldersApi
      .versions(id)
      .then((result) => {
        if (!cancelled) setVersions(result.items)
      })
      .catch(() => {
        if (!cancelled) setVersions([])
      })
    return () => {
      cancelled = true
    }
  }, [id, refresh])
  return versions
}

function VersionList({
  versions,
  current,
  actions,
}: {
  versions: Version[] | null
  current?: number
  actions: (version: Version) => React.ReactNode
}) {
  if (versions === null) return <Skeleton className="h-24" />
  return (
    <ol className="flex max-h-72 flex-col divide-y overflow-y-auto rounded-lg border" aria-label="Version history">
      {versions.map((version) => (
        <li key={version.version} className="flex items-start gap-3 p-3 text-sm">
          <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">v{version.version}</span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {version.created_by && <ActorBadge actor={version.created_by} interactive={false} />}
              {version.created_at && <span>{absoluteTime(new Date(version.created_at))}</span>}
              {version.size !== undefined && <span>{nodeSize(version.size)}</span>}
              {version.version === current && <span className="rounded border px-1">Current</span>}
            </div>
            {version.reason && <p className="break-words">{version.reason}</p>}
            {version.restored_from && <p className="text-xs text-muted-foreground">Restored from v{version.restored_from}</p>}
          </div>
          <div className="flex shrink-0 gap-1">{actions(version)}</div>
        </li>
      ))}
    </ol>
  )
}

// One uploaded file: its history, downloads, a new version, or restoring an old one.
export function FilePanel({
  file,
  canEdit,
  onClose,
  onChanged,
}: {
  file: Folder
  canEdit: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const [node, setNode] = useState(file)
  const [refresh, setRefresh] = useState(0)
  const versions = useVersions(node.id, refresh)
  const picker = useRef<HTMLInputElement>(null)

  async function download(version?: number) {
    try {
      const { url } = await foldersApi.link(node.id, version)
      window.location.assign(url) // served as an attachment, never rendered from the bucket
    } catch (error) {
      toast.error("Couldn't get a download link", { description: explain(error) })
    }
  }

  async function uploadVersion(picked: File) {
    const toastId = toast.loading(`Uploading a new version of ${node.name}…`)
    try {
      const done = await foldersApi.upload(picked, { node }, (status) => toast.loading(`${status} the new version…`, { id: toastId }))
      toast.success(`Saved version ${done.version}`, { id: toastId })
      if (done.file) setNode(done.file)
      setRefresh((n) => n + 1)
      onChanged()
    } catch (error) {
      const stale = error instanceof FoldersError && error.code === "version_conflict"
      toast.error(stale ? "Someone saved a newer version first" : "Couldn't save the new version", {
        id: toastId,
        description: stale ? "Reopen the file to see the latest, then try again." : explain(error),
      })
    }
  }

  async function restore(version: number) {
    try {
      const updated = await foldersApi.restoreVersion(node, version)
      setNode(updated)
      setRefresh((n) => n + 1)
      onChanged()
      toast.success(`Restored version ${version} as version ${updated.current_version}`)
    } catch (error) {
      toast.error("Couldn't restore", { description: explain(error) })
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="break-all">{node.name}</DialogTitle>
          <DialogDescription>
            Version {node.current_version}
            {node.size !== undefined ? ` · ${nodeSize(node.size)}` : ""}. Every upload is checked before anyone can download it.
          </DialogDescription>
        </DialogHeader>
        <VersionList
          versions={versions}
          current={node.current_version}
          actions={(version) => (
            <>
              <Button variant="ghost" size="sm" onClick={() => void download(version.version)}>
                Download
              </Button>
              {canEdit && version.version !== node.current_version && (
                <Button variant="ghost" size="sm" onClick={() => void restore(version.version)}>
                  Restore
                </Button>
              )}
            </>
          )}
        />
        <DialogFooter>
          {canEdit && (
            <>
              <input
                ref={picker}
                type="file"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(event) => {
                  const picked = event.target.files?.[0]
                  event.target.value = ""
                  if (picked) void uploadVersion(picked)
                }}
              />
              <Button variant="outline" onClick={() => picker.current?.click()}>
                Upload new version
              </Button>
            </>
          )}
          <Button onClick={() => void download()}>Download</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Create a note, or open one: read, edit (saved against the version you opened), history.
export function NoteDialog({
  note,
  parentId,
  canEdit,
  onClose,
  onChanged,
}: {
  note?: Folder
  parentId: string
  canEdit: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const [node, setNode] = useState<Folder | undefined>(note)
  const [name, setName] = useState("")
  const [body, setBody] = useState(note ? "" : "")
  const [loaded, setLoaded] = useState(!note)
  const [editing, setEditing] = useState(!note)
  const [busy, setBusy] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const versions = useVersions(node?.id, refresh)

  useEffect(() => {
    if (!note) return
    let cancelled = false
    foldersApi
      .readNote(note.id)
      .then((result) => {
        if (cancelled) return
        setBody(result.body ?? "")
        setNode(result.note)
        setLoaded(true)
      })
      .catch((error) => {
        if (!cancelled) toast.error("Couldn't open the note", { description: explain(error) })
      })
    return () => {
      cancelled = true
    }
  }, [note])

  async function save() {
    setBusy(true)
    try {
      if (!node) {
        const created = await foldersApi.createNote(parentId, name.trim(), body)
        toast.success(`Created ${created.name}`)
        onChanged()
        onClose()
        return
      }
      const updated = await foldersApi.updateNote(node, body)
      setNode(updated)
      setEditing(false)
      setRefresh((n) => n + 1)
      onChanged()
      toast.success(`Saved version ${updated.current_version}`)
    } catch (error) {
      const stale = error instanceof FoldersError && error.code === "version_conflict"
      toast.error(stale ? "Someone saved this note first" : "Couldn't save the note", {
        description: stale ? "Your text is still here. Copy it, reopen the note, and apply your change again." : explain(error),
      })
    } finally {
      setBusy(false)
    }
  }

  async function restore(version: number) {
    if (!node) return
    try {
      const updated = await foldersApi.restoreVersion(node, version)
      const fresh = await foldersApi.readNote(node.id)
      setNode(updated)
      setBody(fresh.body ?? "")
      setRefresh((n) => n + 1)
      onChanged()
      toast.success(`Restored version ${version} as version ${updated.current_version}`)
    } catch (error) {
      toast.error("Couldn't restore", { description: explain(error) })
    }
  }

  const tooBig = new TextEncoder().encode(body).length > 256 * 1024
  const nameInvalid = !node && (!name.trim() || /[\\/]/.test(name))

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="break-all">{node ? node.name : "New note"}</DialogTitle>
          <DialogDescription>
            {node ? `Version ${node.current_version}. Every save keeps the old version.` : "A markdown note in this folder."}
          </DialogDescription>
        </DialogHeader>
        {!node && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="note-name">Name</Label>
            <Input id="note-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} autoFocus />
          </div>
        )}
        {!loaded ? (
          <Skeleton className="h-48" />
        ) : editing ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="note-body">Note</Label>
            <Textarea
              id="note-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              className="min-h-64 font-mono text-sm"
              aria-invalid={tooBig || undefined}
              autoFocus={Boolean(node)}
            />
            {tooBig && <p className="text-sm text-destructive">A note can be at most 256 KB.</p>}
          </div>
        ) : (
          // Shown as text: note bodies are user content, never rendered as HTML.
          <div className="max-h-96 overflow-y-auto rounded-lg border bg-muted/30 p-4 text-sm break-words whitespace-pre-wrap">
            {body || <span className="text-muted-foreground">This note is empty.</span>}
          </div>
        )}
        {node && !editing && (
          <VersionList
            versions={versions}
            current={node.current_version}
            actions={(version) =>
              canEdit && version.version !== node.current_version ? (
                <Button variant="ghost" size="sm" onClick={() => void restore(version.version)}>
                  Restore
                </Button>
              ) : null
            }
          />
        )}
        <DialogFooter>
          {editing ? (
            <>
              <Button variant="outline" onClick={() => (node ? setEditing(false) : onClose())}>
                Cancel
              </Button>
              <Button onClick={() => void save()} disabled={busy || tooBig || nameInvalid}>
                {node ? "Save" : "Create note"}
              </Button>
            </>
          ) : (
            canEdit && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                Edit
              </Button>
            )
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
