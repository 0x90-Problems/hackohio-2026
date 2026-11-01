"use client"

import { readSession } from "@/lib/board-auth"
import { teamFetch } from "@/lib/team-choice"
import type { Actor } from "@/lib/types"

// Client for the folders API (proxied at /api/fs/*). Field names match the
// files service: docs/f1-folders-plan.md in Buc2AgentTerraform.

export const ROOT = "root"

export type Folder = {
  id: string
  type: "folder" | "file" | "note" | "whiteboard"
  current_version?: number
  size?: number
  content_type?: string
  parent_id: string | null
  name: string
  rev: number
  acl_mode?: "inherit" | "restricted"
  created_by?: Actor
  created_at?: string
  updated_at?: string
  deleted_at?: string
  deleted_by?: Actor
  role?: "viewer" | "editor" | "manager"
}

export type Version = {
  version: number
  size?: number
  content_type?: string
  created_by?: Actor
  created_at?: string
  reason?: string | null
  restored_from?: number
  body?: string
}

export type UploadState = { status: "waiting_for_upload" | "scanning" | "committed"; file?: Folder; version?: number }

export type Workspace = { ws_id: string; team_name: string; teams?: string[]; role: "owner" | "member"; root_id: string }
export type Crumb = { id: string; name: string }

export class FoldersError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = "FoldersError"
  }
}

async function call<T>(path: string, init: { method?: string; body?: unknown; rev?: number } = {}): Promise<T> {
  const session = readSession()
  const headers: Record<string, string> = { accept: "application/json" }
  if (session?.secret) headers.authorization = `Bearer ${session.secret}`
  if (init.body !== undefined) headers["content-type"] = "application/json"
  // Not If-Match: Vercel's edge evaluates If-Match against its own response and
  // answers 412 before the request reaches the files API. The proxy converts it.
  if (init.rev !== undefined) headers["x-fs-rev"] = String(init.rev)
  let response: Response
  try {
    response = await teamFetch(`/api/fs/${path}`, {
      method: init.method ?? "GET",
      headers,
      cache: "no-store",
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    })
  } catch {
    throw new FoldersError("network", "Couldn't reach folders. Check your connection.", 0)
  }
  const body = (await response.json().catch(() => null)) as (T & { error?: string; message?: string }) | null
  if (!response.ok) {
    throw new FoldersError(body?.error ?? "error", body?.message ?? `Folders returned ${response.status}`, response.status)
  }
  return body as T
}

const seg = (id: string) => encodeURIComponent(id || ROOT)
// Files and notes have their own routes for the same tree operations.
const base = (node: Folder) => `${node.type === "folder" ? "folders" : "files"}/${seg(node.id)}`

export const foldersApi = {
  async enabled(): Promise<boolean> {
    try {
      const health = await call<{ enabled?: boolean }>("health")
      return Boolean(health.enabled)
    } catch {
      return false
    }
  },
  workspace: () => call<Workspace>("workspace"),
  children: (id: string, cursor?: string | null) =>
    call<{ parent_id: string; role: Folder["role"]; items: Folder[]; next_cursor: string | null }>(
      `folders/${seg(id)}/children${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`
    ),
  path: (id: string) => call<{ items: Crumb[] }>(`folders/${seg(id)}/path`),
  create: (parentId: string, name: string) => call<Folder>("folders", { method: "POST", body: { parent_id: parentId, name } }),
  rename: (node: Folder, name: string) => call<Folder>(base(node), { method: "PATCH", body: { name }, rev: node.rev }),
  move: (node: Folder, parentId: string) => call<Folder>(base(node), { method: "PATCH", body: { parent_id: parentId }, rev: node.rev }),
  trash: (node: Folder) => call<Folder>(base(node), { method: "DELETE", rev: node.rev }),
  restore: (node: Folder) => call<Folder>(`${base(node)}/restore`, { method: "POST", body: {} }),
  listTrash: () => call<{ items: Folder[] }>("trash"),

  // Files and notes
  versions: (id: string) => call<{ items: Version[] }>(`files/${seg(id)}/versions`),
  link: (id: string, version?: number, inline = false) =>
    call<{ url: string; version: number; inline?: boolean }>(
      `files/${seg(id)}${version ? `/versions/${version}` : ""}/link${inline ? "?inline=1" : ""}`
    ),
  content: (id: string, version?: number) =>
    call<{ text: string; truncated: boolean; content_type?: string; version: number }>(
      `files/${seg(id)}/content${version ? `?version=${version}` : ""}`
    ),
  diff: (id: string, from: number, to?: number) =>
    call<{ diff: string; changed: boolean; truncated: boolean; from: number; to: number }>(
      `files/${seg(id)}/diff?from=${from}${to ? `&to=${to}` : ""}`
    ),
  // With a type and no query, lists everything of that type, most recently changed first.
  search: (query: string, type?: Folder["type"]) =>
    call<{ items: (Folder & { path?: string[] })[] }>(`search?q=${encodeURIComponent(query)}${type ? `&type=${type}` : ""}`),
  fileLinks: (id: string) => call<{ items: { target: string }[] }>(`files/${seg(id)}/links`),
  linkTicket: (id: string, key: string) => call<unknown>(`files/${seg(id)}/links`, { method: "POST", body: { target: `ticket:${key}` } }),
  unlinkTicket: (id: string, key: string) =>
    call<unknown>(`files/${seg(id)}/links?target=${encodeURIComponent(`ticket:${key}`)}`, { method: "DELETE" }),
  ticketFiles: (key: string) => call<{ items: Folder[] }>(`links?target=${encodeURIComponent(`ticket:${key}`)}`),
  // A file, note or board with the caller's role on it (readNote's copy has no role).
  node: (id: string) => call<Folder>(`files/${seg(id)}`),
  backlinks: (id: string) => call<{ items: Folder[] }>(`files/${seg(id)}/backlinks`),
  readNote: (id: string, version?: number) =>
    call<Version & { note: Folder }>(`files/${seg(id)}/versions/${version ?? 0}`),
  createBoard: (parentId: string, name: string) => call<Folder>("boards", { method: "POST", body: { parent_id: parentId, name } }),
  createNote: (parentId: string, name: string, body: string) =>
    call<Folder>("notes", { method: "POST", body: { parent_id: parentId, name, body } }),
  updateNote: (note: Folder, body: string, reason?: string) =>
    call<Folder>(`notes/${seg(note.id)}`, { method: "PUT", body: { base_version: note.current_version, body, ...(reason ? { reason } : {}) } }),
  restoreVersion: (node: Folder, version: number) =>
    call<Folder>(`files/${seg(node.id)}/restore-version`, { method: "POST", body: { version, base_version: node.current_version } }),

  /**
   * Upload a new file (parentId) or a new version (node). Bytes go straight to S3
   * with a presigned PUT; the file only appears once the security scan is clean.
   */
  async upload(file: File, target: { parentId: string } | { node: Folder }, onStatus?: (status: string) => void): Promise<UploadState> {
    const started = await call<{ upload_id: string; upload_url: string; headers: Record<string, string> }>("uploads", {
      method: "POST",
      body: {
        name: file.name,
        content_type: file.type,
        size_bytes: file.size,
        ...("node" in target ? { file_id: target.node.id, base_version: target.node.current_version } : { parent_id: target.parentId }),
      },
    })
    onStatus?.("Uploading")
    const put = await fetch(started.upload_url, { method: "PUT", headers: started.headers, body: file }).catch(() => null)
    if (!put?.ok) throw new FoldersError("upload_failed", "The upload didn't go through. Try again.", put?.status ?? 0)
    onStatus?.("Scanning")
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const state = await call<UploadState>(`uploads/${seg(started.upload_id)}`)
      if (state.status === "committed") return state
      await new Promise((resolve) => setTimeout(resolve, attempt < 10 ? 1000 : 3000))
    }
    throw new FoldersError("scan_timeout", "The security scan is taking longer than usual. Check back in a minute.", 0)
  },
}
