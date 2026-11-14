"use client"

import { numberedName } from "@/lib/chat-files"
import { folderNamed, TICKET_FILES_FOLDER } from "@/lib/comment-files"
import { type Folder, FoldersError, foldersApi, ROOT } from "@/lib/folders-api"

// Uploads from a ticket's comment box land in Ticket files/<KEY>/, made on first use with the
// workspace's normal access, so the same people who see the ticket can open them in Folders.

const NAME_TRIES = 5
const folders = new Map<string, Promise<string>>()

async function findFolder(parentId: string, name: string): Promise<Folder | undefined> {
  let cursor: string | null = null
  do {
    const page: { items: Folder[]; next_cursor: string | null } = await foldersApi.children(parentId, cursor)
    const found = folderNamed(page.items, name)
    if (found) return found
    cursor = page.next_cursor
  } while (cursor)
  return undefined
}

/** The folder named name in parentId: the existing one, or a new one (someone else's if they made it first). */
async function ensureFolder(parentId: string, name: string): Promise<string> {
  const existing = await findFolder(parentId, name)
  if (existing) return existing.id
  try {
    return (await foldersApi.create(parentId, name)).id
  } catch (caught) {
    if (!(caught instanceof FoldersError && caught.code === "name_taken")) throw caught
    const winner = await findFolder(parentId, name)
    if (!winner) throw caught
    return winner.id
  }
}

function ticketFolder(ticketKey: string): Promise<string> {
  let pending = folders.get(ticketKey)
  if (!pending) {
    pending = ensureFolder(ROOT, TICKET_FILES_FOLDER).then((parent) => ensureFolder(parent, ticketKey))
    // A failure (or a folder trashed later) shouldn't stick: the next upload asks again.
    pending.catch(() => folders.delete(ticketKey))
    folders.set(ticketKey, pending)
  }
  return pending
}

/** Upload one file for a comment and say what to attach. A name already there gets a number. */
export async function uploadToTicket(ticketKey: string, file: File, onStatus?: (status: string) => void) {
  let parentId = await ticketFolder(ticketKey)
  let refound = false
  for (let attempt = 1; ; ) {
    const named = attempt === 1 ? file : new File([file], numberedName(file.name, attempt), { type: file.type })
    try {
      const done = await foldersApi.upload(named, { parentId }, onStatus, { temporary: true })
      if (!done.file || !done.version) throw new FoldersError("upload_failed", "The upload didn't finish. Try again.", 0)
      return { file_id: done.file.id, version: done.version, name: done.file.name }
    } catch (caught) {
      if (caught instanceof FoldersError && caught.status === 404 && !refound) {
        // The folder was trashed since we looked it up: find or make it again, once.
        refound = true
        folders.delete(ticketKey)
        parentId = await ticketFolder(ticketKey)
        continue
      }
      if (!(caught instanceof FoldersError) || caught.code !== "name_taken" || attempt >= NAME_TRIES) throw caught
      attempt += 1
    }
  }
}
