"use client"

import { useEffect, useState } from "react"

import { readSession } from "@/lib/board-auth"
import type { Folder } from "@/lib/folders-api"

// Client for whiteboards (proxied at /api/wb/* to /wb/v1/*). Field names match the
// whiteboard service: docs/whiteboard-plan.md in Buc2AgentTerraform.

export type BoardInfo = {
  board: Folder
  role: "viewer" | "editor" | "manager"
  seq: number
  locked: boolean
  agents_paused: boolean
}

export type Session = { url: string; protocols: string[]; read_only: boolean; expires_in: number }

// Elements are Excalidraw's own JSON; the server adds customData {created_by, last_edited_by}.
export type WireElement = Record<string, unknown> & { id: string; version: number; versionNonce: number }

export type ElementsPage = { elements: WireElement[]; seq: number; next_since: number | null }

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

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const session = readSession()
  const headers: Record<string, string> = { accept: "application/json" }
  if (session?.secret) headers.authorization = `Bearer ${session.secret}`
  if (init.body !== undefined) headers["content-type"] = "application/json"
  let response: Response
  try {
    response = await fetch(`/api/wb/${path}`, {
      method: init.method ?? "GET",
      headers,
      cache: "no-store",
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
  send: (id: string, elements: WireElement[]) =>
    call<{ accepted: WireElement[]; stale: WireElement[]; seq: number }>(`boards/${seg(id)}/elements`, { method: "POST", body: { elements } }),
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
