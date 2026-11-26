"use client"

// Change or remove a picture (NSB-97): yours on your profile, the organization's for org admins.
// The picture is cropped to the middle square and shrunk in the browser before it's sent.

import { useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { shrinkPicture } from "@/lib/pictures"

export function PicturePicker({
  label,
  current,
  onSave,
  preview,
}: {
  /** What the picture is of, for the buttons: "your picture", "the organization's picture". */
  label: string
  current?: string
  onSave: (picture: string | null) => Promise<void>
  /** Shows the picked picture before it's saved. */
  preview: (picture: string | undefined) => React.ReactNode
}) {
  const input = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function pick(file: File | undefined) {
    if (!file) return
    try {
      setDraft(await shrinkPicture(file))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't use that picture")
    }
  }

  async function save(picture: string | null) {
    setBusy(true)
    try {
      await onSave(picture)
      setDraft(null)
      toast.success(picture ? "Picture saved" : "Picture removed")
    } catch (error) {
      toast.error("Couldn't save the picture", { description: error instanceof Error ? error.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3" data-slot="picture-picker">
      {draft ? preview(draft) : null}
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        aria-label={`Choose ${label}`}
        onChange={(event) => {
          void pick(event.target.files?.[0])
          event.target.value = ""
        }}
      />
      {draft ? (
        <>
          <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => void save(draft)}>
            Save picture
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setDraft(null)}>
            Cancel
          </Button>
        </>
      ) : (
        <>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
            {current ? "Change picture" : "Add a picture"}
          </Button>
          {current ? (
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void save(null)}>
              Remove
            </Button>
          ) : null}
        </>
      )}
    </div>
  )
}
