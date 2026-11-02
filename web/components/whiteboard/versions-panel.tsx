"use client"

import { useEffect, useRef, useState } from "react"

import { ActorBadge } from "@/components/actor-badge"
import { DownloadIcon, HistoryIcon, SaveIcon, XIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { foldersApi, FoldersError, type Version } from "@/lib/folders-api"
import { absoluteTime } from "@/lib/format"

function explain(error: unknown) {
  return error instanceof FoldersError ? error.message : "Try again in a moment."
}

// The board's saved versions. The list is read each time it matters: a push saying someone saved
// can be lost, so the push only ever makes this look sooner.
export function VersionsPanel({
  boardId,
  canEdit,
  refreshKey,
  saving,
  busyVersion,
  onSave,
  onRestore,
  onDownload,
  onClose,
}: {
  boardId: string
  canEdit: boolean
  refreshKey: number
  saving: boolean
  busyVersion: number | null
  onSave: (reason: string) => Promise<boolean>
  onRestore: (version: Version) => void
  onDownload: (version: Version) => void
  onClose: () => void
}) {
  const [versions, setVersions] = useState<Version[] | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [reason, setReason] = useState("")
  const closeButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeButton.current?.focus()
  }, [])

  useEffect(() => {
    let cancelled = false
    foldersApi.versions(boardId).then(
      (page) => {
        if (cancelled) return
        setVersions(page.items)
        setFailure(null)
      },
      (error) => {
        if (!cancelled) setFailure(explain(error))
      }
    )
    return () => {
      cancelled = true
    }
  }, [boardId, refreshKey])

  const current = versions?.[0]?.version

  return (
    <aside
      aria-label="Saved versions"
      className="absolute inset-y-0 right-0 z-10 flex w-80 max-w-full flex-col border-l bg-background motion-safe:animate-in motion-safe:slide-in-from-right-2 motion-safe:duration-150 lg:static lg:shrink-0"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation()
          onClose()
        }
      }}
    >
      <div className="flex items-center gap-2 border-b p-3">
        <HistoryIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-sm font-semibold">Versions</h2>
        <Button ref={closeButton} variant="ghost" size="icon-sm" className="ml-auto" aria-label="Close versions" onClick={onClose}>
          <XIcon aria-hidden="true" />
        </Button>
      </div>
      {canEdit ? (
        <form
          className="flex flex-col gap-2 border-b p-3"
          onSubmit={(event) => {
            event.preventDefault()
            void onSave(reason).then((saved) => saved && setReason(""))
          }}
        >
          <Input value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} placeholder="What changed (optional)" aria-label="What changed (optional)" className="h-8" />
          <Button type="submit" variant="outline" size="sm" disabled={saving}>
            <SaveIcon data-icon="inline-start" aria-hidden="true" />
            {saving ? "Saving…" : "Save a version"}
          </Button>
          <p className="text-xs text-muted-foreground">Boards also save themselves after 10 minutes of edits.</p>
        </form>
      ) : null}
      {failure ? (
        <p className="p-4 text-sm text-muted-foreground" role="alert">
          Couldn&apos;t load the versions. {failure}
        </p>
      ) : versions === null ? (
        <div className="flex flex-col gap-2 p-3" aria-busy="true" aria-label="Loading versions">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : (
        <ol className="min-h-0 flex-1 divide-y overflow-y-auto" aria-label="Version history">
          {versions.map((version) => (
            <li key={version.version} className="flex flex-col gap-1.5 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">Version {version.version}</span>
                {version.version === current ? <span className="rounded border px-1 text-xs text-muted-foreground">Latest</span> : null}
              </div>
              {version.reason ? <p className="break-words text-muted-foreground">{version.reason}</p> : null}
              {version.restored_from && !version.reason ? <p className="text-xs text-muted-foreground">Restored from version {version.restored_from}</p> : null}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {version.created_by ? <ActorBadge actor={version.created_by} interactive={false} /> : null}
                {version.created_at ? <span>{absoluteTime(new Date(version.created_at))}</span> : null}
              </div>
              <div className="flex gap-1">
                {canEdit ? (
                  <Button variant="outline" size="xs" disabled={busyVersion !== null} onClick={() => onRestore(version)}>
                    {busyVersion === version.version ? "Restoring…" : "Restore"}
                  </Button>
                ) : null}
                <Button variant="ghost" size="xs" aria-label={`Download version ${version.version}`} onClick={() => onDownload(version)}>
                  <DownloadIcon data-icon="inline-start" aria-hidden="true" />
                  Download
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </aside>
  )
}
