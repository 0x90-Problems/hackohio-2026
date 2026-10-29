"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"

import { FileIcon, FileTextIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { type Folder, FoldersError, foldersApi } from "@/lib/folders-api"

// Files linked to a ticket (from the Files page). Hidden when there are none or
// folders are off, so tickets without files look the same as before.
export function TicketFiles({ ticketKey }: { ticketKey: string }) {
  const [files, setFiles] = useState<Folder[]>([])

  useEffect(() => {
    let cancelled = false
    foldersApi
      .ticketFiles(ticketKey)
      .then((result) => !cancelled && setFiles(result.items))
      .catch(() => !cancelled && setFiles([]))
    return () => {
      cancelled = true
    }
  }, [ticketKey])

  if (files.length === 0) return null

  async function download(file: Folder) {
    try {
      const { url } = await foldersApi.link(file.id)
      window.location.assign(url)
    } catch (error) {
      toast.error("Couldn't get a download link", { description: error instanceof FoldersError ? error.message : undefined })
    }
  }

  return (
    <section className="flex flex-col gap-3 p-6" aria-label="Linked files">
      <h3 className="font-mono text-xs tracking-widest text-muted-foreground uppercase">Files</h3>
      <ul className="flex flex-col gap-1.5">
        {files.map((file) => (
          <li key={file.id} className="flex items-center gap-2 text-sm">
            {file.type === "note" ? (
              <FileTextIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            ) : (
              <FileIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
            <span className="min-w-0 flex-1 truncate">{file.name}</span>
            {file.current_version && <span className="text-xs text-muted-foreground">v{file.current_version}</span>}
            {file.type === "file" ? (
              <Button variant="ghost" size="sm" onClick={() => void download(file)}>
                Download
              </Button>
            ) : (
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/files?folder=${encodeURIComponent(file.parent_id ?? "root")}`}>Open in Files</Link>
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
