"use client"

import { readSession } from "@/lib/board-auth"
import { fileViewPath } from "@/lib/file-view"
import { FoldersError } from "@/lib/folders-api"
import { activeTeam } from "@/lib/team-choice"

// Links people can open, copy or download (NSB-57): always the app's own /api/files/<id>/view,
// never a storage link. That address checks who's signed in before it hands over the file.

let synced: { secret: string; done: Promise<void> } | null = null

/**
 * Make sure /api/files can tell who this is (the tab's session, as an HttpOnly cookie). Clicks
 * pass fresh, since another tab may have signed in as someone else since; it's one quick call
 * to this app, not to the files API.
 */
export function ensureFileAccess(fresh = false): Promise<void> {
  const secret = readSession()?.secret
  if (!secret) return Promise.reject(new FoldersError("unauthorized", "Sign in to open files.", 401))
  if (!fresh && synced?.secret === secret) return synced.done
  const done = fetch("/api/files/session", { method: "POST", headers: { authorization: `Bearer ${secret}` }, cache: "no-store" }).then((response) => {
    if (!response.ok) throw new FoldersError("unauthorized", "Couldn't open files right now. Try again.", response.status)
  })
  synced = { secret, done }
  done.catch(() => {
    if (synced?.done === done) synced = null
  })
  return done
}

/** The address of a file to view in the browser (images and PDFs) or, with download, to save. */
export function fileViewUrl(fileId: string, options: { version?: number; download?: boolean } = {}): string {
  return fileViewPath(fileId, { ...options, team: activeTeam() || undefined })
}

/**
 * Downloads in this tab. Asks first (without following the redirect), so a file that's gone or
 * off limits shows the app's error instead of replacing the page with one.
 */
export async function downloadFile(fileId: string, version?: number): Promise<void> {
  await ensureFileAccess(true)
  const url = fileViewUrl(fileId, { version, download: true })
  const check = await fetch(url, { redirect: "manual", cache: "no-store", headers: { accept: "application/json" } }).catch(() => null)
  if (!check) throw new FoldersError("network", "Couldn't reach files. Check your connection.", 0)
  if (check.type !== "opaqueredirect") {
    const body = (await check.json().catch(() => null)) as { error?: string; message?: string } | null
    throw new FoldersError(body?.error ?? "error", body?.message ?? "Couldn't download that file.", check.status)
  }
  window.location.assign(url)
}

/** Views in a new tab (images and PDFs show in the browser; anything else downloads there). */
export async function openFileInNewTab(fileId: string, version?: number): Promise<void> {
  // Opened first, so the popup blocker still sees the click.
  const viewer = window.open("about:blank", "_blank")
  try {
    await ensureFileAccess(true)
    if (viewer) {
      viewer.opener = null
      viewer.location.href = new URL(fileViewUrl(fileId, { version }), window.location.origin).toString()
    }
  } catch (error) {
    viewer?.close()
    throw error
  }
}
