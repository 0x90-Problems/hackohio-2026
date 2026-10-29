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

const DIFFABLE = ["text/plain", "text/markdown", "text/csv", "application/json"]

// What changed between an older version and the current one (unified diff).
function DiffView({ id, from, to, onClose }: { id: string; from: number; to: number; onClose: () => void }) {
  const [result, setResult] = useState<{ diff: string; changed: boolean; truncated: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    foldersApi
      .diff(id, from, to)
      .then((value) => !cancelled && setResult(value))
      .catch((reason) => !cancelled && setError(explain(reason)))
    return () => {
      cancelled = true
    }
  }, [id, from, to])
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-medium">
          Changes from v{from} to v{to}
        </span>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : result === null ? (
        <Skeleton className="h-24" />
      ) : !result.changed ? (
        <p className="text-sm text-muted-foreground">No changes.</p>
      ) : (
        <pre className="max-h-72 overflow-auto rounded bg-muted/30 p-2 font-mono text-xs leading-relaxed" aria-label="Diff">
          {result.diff.split("\n").map((line, index) => (
            <div
              key={index}
              className={
                line.startsWith("+") && !line.startsWith("+++")
                  ? "bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300"
                  : line.startsWith("-") && !line.startsWith("---")
                    ? "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300"
                    : line.startsWith("@@")
                      ? "text-muted-foreground"
                      : undefined
              }
            >
              {line || " "}
            </div>
          ))}
          {result.truncated && <div className="text-muted-foreground">… (longer diffs are cut off)</div>}
        </pre>
      )}
    </div>
  )
}

// Tickets this file is linked to; editors can link more by key or unlink.
function TicketLinks({ id, canEdit }: { id: string; canEdit: boolean }) {
  const [links, setLinks] = useState<string[] | null>(null)
  const [key, setKey] = useState("")
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    let cancelled = false
    foldersApi
      .fileLinks(id)
      .then((result) => !cancelled && setLinks(result.items.map((item) => item.target.replace(/^ticket:/, ""))))
      .catch(() => !cancelled && setLinks([]))
    return () => {
      cancelled = true
    }
  }, [id, refresh])
  const valid = /^[A-Z][A-Z0-9]{1,5}-\d+$/.test(key.trim().toUpperCase())

  async function change(action: () => Promise<unknown>, done: string) {
    try {
      await action()
      toast.success(done)
      setKey("")
      setRefresh((n) => n + 1)
    } catch (error) {
      toast.error("Couldn't update the ticket link", { description: explain(error) })
    }
  }

  return (
    <section className="flex flex-col gap-2" aria-label="Linked tickets">
      <h3 className="text-sm font-medium">Linked tickets</h3>
      {links === null ? (
        <Skeleton className="h-6" />
      ) : links.length === 0 ? (
        <p className="text-sm text-muted-foreground">Not linked to any ticket.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {links.map((ticket) => (
            <li key={ticket} className="flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-xs">
              {ticket}
              {canEdit && (
                <button
                  type="button"
                  aria-label={`Unlink ${ticket}`}
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => void change(() => foldersApi.unlinkTicket(id, ticket), `Unlinked ${ticket}`)}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            const ticket = key.trim().toUpperCase()
            if (valid) void change(() => foldersApi.linkTicket(id, ticket), `Linked to ${ticket}`)
          }}
        >
          <Input
            aria-label="Ticket key"
            placeholder="e.g. CLW-21"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            className="h-8 w-36 font-mono text-xs"
          />
          <Button type="submit" variant="outline" size="sm" disabled={!valid}>
            Link
          </Button>
        </form>
      )}
    </section>
  )
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
  const [comparing, setComparing] = useState<number | null>(null)
  const diffable = DIFFABLE.includes(node.content_type ?? "")

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
              {diffable && version.version !== node.current_version && (
                <Button variant="ghost" size="sm" onClick={() => setComparing(version.version)}>
                  Compare
                </Button>
              )}
              {canEdit && version.version !== node.current_version && (
                <Button variant="ghost" size="sm" onClick={() => void restore(version.version)}>
                  Restore
                </Button>
              )}
            </>
          )}
        />
        {comparing !== null && node.current_version && (
          <DiffView id={node.id} from={comparing} to={node.current_version} onClose={() => setComparing(null)} />
        )}
        <TicketLinks id={node.id} canEdit={canEdit} />
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
  const [comparing, setComparing] = useState<number | null>(null)

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
        if (!cancelled) toast.error("Couldn't open the document", { description: explain(error) })
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
      toast.error(stale ? "Someone saved this document first" : "Couldn't save the document", {
        description: stale ? "Your text is still here. Copy it, reopen the document, and apply your change again." : explain(error),
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
          <DialogTitle className="break-all">{node ? node.name : "New document"}</DialogTitle>
          <DialogDescription>
            {node ? `Version ${node.current_version}. Every save keeps the old version.` : "A document in this folder, saved as markdown."}
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
            <Label htmlFor="note-body">Document</Label>
            <Textarea
              id="note-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              className="min-h-64 font-mono text-sm"
              aria-invalid={tooBig || undefined}
              autoFocus={Boolean(node)}
            />
            {tooBig && <p className="text-sm text-destructive">A document can be at most 256 KB.</p>}
          </div>
        ) : (
          // Shown as text: note bodies are user content, never rendered as HTML.
          <div className="max-h-96 overflow-y-auto rounded-lg border bg-muted/30 p-4 text-sm break-words whitespace-pre-wrap">
            {body || <span className="text-muted-foreground">This document is empty.</span>}
          </div>
        )}
        {node && !editing && (
          <VersionList
            versions={versions}
            current={node.current_version}
            actions={(version) =>
              version.version !== node.current_version ? (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setComparing(version.version)}>
                    Compare
                  </Button>
                  {canEdit && (
                    <Button variant="ghost" size="sm" onClick={() => void restore(version.version)}>
                      Restore
                    </Button>
                  )}
                </>
              ) : null
            }
          />
        )}
        {node && !editing && comparing !== null && node.current_version && (
          <DiffView id={node.id} from={comparing} to={node.current_version} onClose={() => setComparing(null)} />
        )}
        <DialogFooter>
          {editing ? (
            <>
              <Button variant="outline" onClick={() => (node ? setEditing(false) : onClose())}>
                Cancel
              </Button>
              <Button onClick={() => void save()} disabled={busy || tooBig || nameInvalid}>
                {node ? "Save" : "Create document"}
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
