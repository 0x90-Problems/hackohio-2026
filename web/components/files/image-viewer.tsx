"use client"

import { useState } from "react"

import { ExternalLinkIcon, Maximize2Icon, XIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

// An image preview that opens full size when clicked, fitted to the window, like opening it
// in its own browser tab. `url` is the inline link the preview already fetched, so viewing it
// costs no extra call. Links last 5 minutes; after that the new tab may need the file reopened.
export function ExpandableImage({ url, name }: { url: string; name: string }) {
  const [broken, setBroken] = useState(false)

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          title="View full size"
          className="group relative cursor-zoom-in overflow-hidden rounded-lg border focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL, not a static asset */}
          <img src={url} alt={`Preview of ${name}`} className="max-h-[50dvh] w-full object-contain" />
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
          {/* Opens on the storage domain, never ours, and the new tab can't reach back into this one. */}
          <Button variant="outline" size="sm" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">
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
          {broken ? (
            <p className="text-sm text-muted-foreground">This image couldn&apos;t load. Close it and open the file again.</p>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL, not a static asset
            <img src={url} alt={name} className="max-h-full max-w-full object-contain" onError={() => setBroken(true)} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
