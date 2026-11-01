"use client"

import { type ChatAttachment, chatApi } from "@/lib/chat-api"
import { FoldersError, foldersApi, type ResolvedFile } from "@/lib/folders-api"

// What a viewer may see of a message's attachments. A message holds only {file_id, version}:
// the name, and whether there's anything to open at all, come from Files, asked as this viewer.
// One call per page of attachments, however many there are, and none again while it's fresh.

const FRESH_MS = 5 * 60_000
const FRESH_NO_ACCESS_MS = 60_000 // they may have just been added to the channel
const FRESH_FAILED_MS = 30_000
const BATCH = 25 // the most Files answers at once

export type AttachmentState = { status: "checking" } | { status: "failed" } | { status: "ready"; file: ResolvedFile }

const key = (item: ChatAttachment) => `${item.file_id}@${item.version}`

function freshFor(state: AttachmentState) {
  if (state.status === "failed") return FRESH_FAILED_MS
  return state.status === "ready" && !state.file.available ? FRESH_NO_ACCESS_MS : FRESH_MS
}

export class AttachmentDirectory {
  private entries = new Map<string, { state: AttachmentState; at: number }>()
  private queue = new Map<string, ChatAttachment>()
  private running = false
  private revision = 0
  private listeners = new Set<() => void>()

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  snapshot = () => this.revision

  get(item: ChatAttachment): AttachmentState {
    return this.entries.get(key(item))?.state ?? { status: "checking" }
  }

  /** Ask about these unless the answer is still fresh. Chips mounting together share one call. */
  want(item: ChatAttachment, force = false) {
    const known = this.entries.get(key(item))
    const fresh = known && Date.now() - known.at < freshFor(known.state)
    if (fresh && !force) return
    this.queue.set(key(item), item)
    if (force) this.set(item, { status: "checking" })
    if (!this.running) {
      this.running = true
      setTimeout(() => void this.drain(), 0)
    }
  }

  private set(item: ChatAttachment, state: AttachmentState) {
    this.entries.set(key(item), { state, at: Date.now() })
    this.revision += 1
    for (const listener of this.listeners) listener()
  }

  // One request at a time: pages of chat never add up to many concurrent calls.
  private async drain() {
    while (this.queue.size) {
      const batch = [...this.queue.values()].slice(0, BATCH)
      for (const item of batch) this.queue.delete(key(item))
      try {
        const { items } = await foldersApi.resolveFiles(batch)
        batch.forEach((item, index) => {
          const file = items[index]
          this.set(item, file ? { status: "ready", file } : { status: "failed" })
        })
      } catch {
        for (const item of batch) this.set(item, { status: "failed" })
      }
    }
    this.running = false
  }
}

/** "report.pdf" -> "report (2).pdf" */
export function numberedName(name: string, n: number) {
  const dot = name.lastIndexOf(".")
  return dot > 0 ? `${name.slice(0, dot)} (${n})${name.slice(dot)}` : `${name} (${n})`
}

const NAME_TRIES = 5

/** Upload into the channel's Chat/<channel>/ folder and say what to attach. A name already there gets a number. */
export async function uploadToChannel(channelId: string, file: File, onStatus?: (status: string) => void): Promise<ChatAttachment & { name: string }> {
  const { folder_id: parentId } = await chatApi.channelFolder(channelId)
  for (let attempt = 1; ; attempt += 1) {
    const named = attempt === 1 ? file : new File([file], numberedName(file.name, attempt), { type: file.type })
    try {
      const done = await foldersApi.upload(named, { parentId }, onStatus)
      if (!done.file || !done.version) throw new FoldersError("upload_failed", "The upload didn't finish. Try again.", 0)
      return { file_id: done.file.id, version: done.version, name: done.file.name }
    } catch (caught) {
      if (!(caught instanceof FoldersError) || caught.code !== "name_taken" || attempt >= NAME_TRIES) throw caught
    }
  }
}
