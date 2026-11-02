"use client"

import { useEffect, useState } from "react"

import { readSession } from "@/lib/board-auth"
import type { Folder } from "@/lib/folders-api"
import { teamFetch } from "@/lib/team-choice"

// Client for whiteboards (proxied at /api/wb/* to /wb/v1/*). Field names match the
// whiteboard service: docs/whiteboard-plan.md in Buc2AgentTerraform.

export type BoardInfo = {
  board: Folder
  role: "viewer" | "editor" | "manager"
  seq: number
  locked: boolean
  agents_paused: boolean
  agents_may_edit_all?: boolean
  agents_enabled?: boolean // the service-wide switch; hides agent controls while off
}

export type BoardSettings = Pick<BoardInfo, "locked" | "agents_paused" | "agents_may_edit_all">
export type AgentActivity = { agent_id: string; acting_for: string; changes: number; last_at: number }

export type Session = { url: string; protocols: string[]; read_only: boolean; expires_in: number }

// Elements are Excalidraw's own JSON; the server adds customData {created_by, last_edited_by}.
export type WireElement = Record<string, unknown> & { id: string; version: number; versionNonce: number }

export type ElementsPage = { elements: WireElement[]; seq: number; next_since: number | null }
export type SendResult = { accepted: WireElement[]; stale: WireElement[]; seq: number; first?: number }

export type SaveResult = { saved: boolean; unchanged?: boolean; version?: number; seq: number }
export type AutosaveResult = { saved: boolean; dirty?: boolean; due_in?: number; version?: number; seq: number }
export type RestoreResult = {
  done: boolean
  restored: number
  remaining: number
  through_seq: number
  from_version: number
  seq: number
  before_version?: number // the version holding what was there before
  version?: number // the version recording this restore
}

export class WhiteboardError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = "WhiteboardError"
  }
}

async function call<T>(path: string, init: { method?: string; body?: unknown; keepalive?: boolean } = {}): Promise<T> {
  const session = readSession()
  const headers: Record<string, string> = { accept: "application/json" }
  if (session?.secret) headers.authorization = `Bearer ${session.secret}`
  if (init.body !== undefined) headers["content-type"] = "application/json"
  let response: Response
  try {
    response = await teamFetch(`/api/wb/${path}`, {
      method: init.method ?? "GET",
      headers,
      cache: "no-store",
      keepalive: init.keepalive,
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    })
  } catch {
    throw new WhiteboardError("network", "Couldn't reach the whiteboard. Check your connection.", 0)
  }
  const body = (await response.json().catch(() => null)) as (T & { error?: { code?: string; message?: string } }) | null
  if (!response.ok) {
    throw new WhiteboardError(body?.error?.code ?? "error", body?.error?.message ?? `Whiteboard returned ${response.status}`, response.status)
  }
  return body as T
}

const seg = encodeURIComponent

const RESTORE_TRIES = 4
const RESTORE_RETRY_MS = 2_000

export const whiteboardApi = {
  async enabled(): Promise<boolean> {
    try {
      return Boolean((await call<{ enabled?: boolean }>("health")).enabled)
    } catch {
      return false
    }
  },
  board: (id: string) => call<BoardInfo>(`boards/${seg(id)}`),
  session: (id: string) => call<Session>(`boards/${seg(id)}/session`, { method: "POST", body: {} }),
  elements: (id: string, since = 0) => call<ElementsPage>(`boards/${seg(id)}/elements?since=${since}`),
  send: (id: string, elements: WireElement[], keepalive = false) =>
    call<SendResult>(`boards/${seg(id)}/elements`, { method: "POST", body: { elements }, keepalive }),
  settings: (id: string, change: Partial<BoardSettings>) => call<BoardSettings>(`boards/${seg(id)}/settings`, { method: "POST", body: change }),
  agents: (id: string) => call<{ agents: AgentActivity[] }>(`boards/${seg(id)}/agents`),
  undoAgent: (id: string, agentId: string) =>
    call<{ undone: number; skipped: number; seq: number }>(`boards/${seg(id)}/undo-agent`, { method: "POST", body: { agent_id: agentId } }),
  save: (id: string, change: { reason?: string; base_version?: number }) => call<SaveResult>(`boards/${seg(id)}/save`, { method: "POST", body: change }),
  autosave: (id: string) => call<AutosaveResult>(`boards/${seg(id)}/autosave`, { method: "POST", body: {} }),
  /** Restore a version. A large board takes several calls; each one only writes what still differs. */
  async restore(id: string, version: number, onProgress?: (remaining: number) => void): Promise<RestoreResult> {
    let through: number | undefined
    let before: number | undefined
    let restored = 0
    for (let failures = 0; ; ) {
      let page: RestoreResult
      try {
        page = await call<RestoreResult>(`boards/${seg(id)}/restore`, { method: "POST", body: { version, ...(through !== undefined ? { through_seq: through } : {}) } })
      } catch (error) {
        const passing = error instanceof WhiteboardError && (error.status === 0 || error.status === 429 || error.status >= 500)
        // Only retry once the first page has landed: that one also makes the safety copy.
        if (!passing || through === undefined || ++failures >= RESTORE_TRIES) throw error
        await new Promise((resolve) => setTimeout(resolve, RESTORE_RETRY_MS * failures))
        continue
      }
      failures = 0
      through = page.through_seq
      before ??= page.before_version
      restored += page.restored
      if (page.done) return { ...page, restored, ...(before !== undefined ? { before_version: before } : {}) }
      onProgress?.(page.remaining)
    }
  },
}

// Whiteboards ship behind whiteboard.enabled; ask once per page load.
let check: Promise<boolean> | null = null
export function whiteboardEnabled() {
  check ??= whiteboardApi.enabled()
  return check
}

export function useWhiteboardEnabled() {
  const [on, setOn] = useState(false)
  useEffect(() => {
    let cancelled = false
    void whiteboardEnabled().then((value) => {
      if (!cancelled) setOn(value)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return on
}
