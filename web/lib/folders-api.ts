"use client"

import { readSession } from "@/lib/board-auth"
import type { Actor } from "@/lib/types"

// Client for the folders API (proxied at /api/fs/*). Field names match the
// files service: docs/f1-folders-plan.md in Buc2AgentTerraform.

export const ROOT = "root"

export type Folder = {
  id: string
  type: "folder"
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

export type Workspace = { ws_id: string; team_name: string; role: "owner" | "member"; root_id: string }
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
  if (init.rev !== undefined) headers["if-match"] = `"rev-${init.rev}"`
  let response: Response
  try {
    response = await fetch(`/api/fs/${path}`, {
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
  rename: (folder: Folder, name: string) =>
    call<Folder>(`folders/${seg(folder.id)}`, { method: "PATCH", body: { name }, rev: folder.rev }),
  move: (folder: Folder, parentId: string) =>
    call<Folder>(`folders/${seg(folder.id)}`, { method: "PATCH", body: { parent_id: parentId }, rev: folder.rev }),
  trash: (folder: Folder) => call<Folder>(`folders/${seg(folder.id)}`, { method: "DELETE", rev: folder.rev }),
  restore: (folder: Folder) => call<Folder>(`folders/${seg(folder.id)}/restore`, { method: "POST", body: {} }),
  listTrash: () => call<{ items: Folder[] }>("trash"),
}
