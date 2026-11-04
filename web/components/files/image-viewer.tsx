"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { ExternalLinkIcon, Maximize2Icon, XIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { ensureFileAccess, fileViewUrl, openFileInNewTab } from "@/lib/file-links"
import { foldersApi } from "@/lib/folders-api"

const MAX_REFETCH = 2 // a link that fails twice more is a real failure, not just an expired one

/**
 * A fresh inline storage link for showing an image in this page. Links last a minute, so when
 * the image fails to load (usually: it expired), `retry` asks for a new one instead of leaving
 * a broken image. `url` is "" once it has really failed.
 */
export function useImageLink(fileId: string, enabled = true) {
  // Kept with the file it's for, so switching files never shows the last one's image.
  const [link, setLink] = useState<{ fileId: string; url: string } | null>(null)
  const tries = useRef(0)
  const current = useRef(fileId)

  const fetchLink = useCallback(() => {
    const asked = fileId
    foldersApi
      .link(asked, undefined, true)
      .then((got) => current.current === asked && setLink({ fileId: asked, url: got.url }))
      .catch(() => current.current === asked && setLink({ fileId: asked, url: "" }))
  }, [fileId])

  useEffect(() => {
    current.current = fileId
    tries.current = 0
    if (enabled) fetchLink()
    return () => {
      current.current = ""
    }
  }, [fileId, enabled, fetchLink])

  const retry = useCallback(() => {
    if (tries.current >= MAX_REFETCH) return setLink({ fileId, url: "" })
    tries.current += 1
    fetchLink()
  }, [fetchLink, fileId])

  // Once a link has worked, a later failure is a fresh expiry, so it gets its own retries.
  const loaded = useCallback(() => {
    tries.current = 0
  }, [])

  return { url: link?.fileId === fileId ? link.url : null, retry, loaded }
}

// An image preview that opens full size when clicked, fitted to the window. The preview uses a
// one-minute storage link (refetched if it expires); "Open in new tab" uses the app's own address
// for the file, which only opens for someone signed in, so copying it shares nothing.
export function ExpandableImage({ fileId, name }: { fileId: string; name: string }) {
  const { url, retry, loaded } = useImageLink(fileId)

  useEffect(() => {
    // So a middle-click or "open in new tab" on the link knows who's asking.
    ensureFileAccess().catch(() => undefined)
  }, [])

  if (url === null) return <Skeleton className="aspect-video w-full" />
  if (!url) return <p className="text-sm text-muted-foreground">No preview available.</p>

  const viewHref = fileViewUrl(fileId)
  const openInNewTab = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    openFileInNewTab(fileId).catch((error: unknown) =>
      toast.error("Couldn't open the image", { description: error instanceof Error ? error.message : undefined })
    )
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          title="View full size"
          className="group relative cursor-zoom-in overflow-hidden rounded-lg border focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL, not a static asset */}
          <img src={url} alt={`Preview of ${name}`} className="max-h-[50dvh] w-full object-contain" onError={retry} onLoad={loaded} />
          <span className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-background/90 px-2 py-1 text-xs opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <Maximize2Icon className="size-3.5" aria-hidden="true" />
            View full size
          </span>
        </button>
      </DialogTrigger>
      {/* Fills the whole window; Esc or the close button closes it. */}
      <DialogContent
        showCloseButton={false}
        className="top-0 left-0 flex h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-3 rounded-none p-3 ring-0 sm:max-w-none sm:p-4"
      >
        <div className="flex items-center gap-2">
          <DialogTitle className="min-w-0 flex-1 truncate">{name}</DialogTitle>
          <DialogDescription className="sr-only">The image at full size. Press Escape to close.</DialogDescription>
          {/* The app's own address: it checks you're signed in, then shows the file. */}
          <Button variant="outline" size="sm" asChild>
            <a href={viewHref} target="_blank" rel="noopener noreferrer" onClick={openInNewTab}>
              <ExternalLinkIcon data-icon="inline-start" aria-hidden="true" />
              Open in new tab
            </a>
          </Button>
          <DialogClose asChild>
            <Button variant="ghost" size="icon-sm">
              <XIcon aria-hidden="true" />
              <span className="sr-only">Close</span>
            </Button>
          </DialogClose>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL, not a static asset */}
          <img src={url} alt={name} className="max-h-full max-w-full object-contain" onError={retry} onLoad={loaded} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
