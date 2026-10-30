"use client"

import * as Y from "yjs"
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from "y-protocols/awareness"

import { readSession } from "@/lib/board-auth"

// Live documents: a Yjs document kept in sync through the documents relay
// (/api/docs-live/* → /docs/v1/*, then a WebSocket). Design: docs/documents-plan.md.

export type Session = { url: string; protocols: string[]; read_only: boolean; expires_in: number }
export type Who = { type: "human" | "agent"; id: string; name?: string }
export type LiveStatus = "connecting" | "live" | "reconnecting" | "off"

export class LiveError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const session = readSession()
  const headers: Record<string, string> = { accept: "application/json" }
  if (session?.secret) headers.authorization = `Bearer ${session.secret}`
  if (init.body !== undefined) headers["content-type"] = "application/json"
  let response: Response
  try {
    response = await fetch(`/api/docs-live/${path}`, {
      method: init.method ?? "GET",
      headers,
      cache: "no-store",
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    })
  } catch {
    throw new LiveError("network", "Couldn't reach live editing.", 0)
  }
  const body = (await response.json().catch(() => null)) as (T & { error?: { code?: string; message?: string } }) | null
  if (!response.ok) throw new LiveError(body?.error?.code ?? "error", body?.error?.message ?? `Live editing returned ${response.status}`, response.status)
  return body as T
}

export const docsLiveApi = {
  async enabled() {
    try {
      return Boolean((await call<{ enabled?: boolean }>("health")).enabled)
    } catch {
      return false
    }
  },
  session: (id: string) => call<Session>(`pages/${encodeURIComponent(id)}/session`, { method: "POST", body: {} }),
  updates: (id: string, since: number) =>
    call<{ snapshot: string | null; updates: string[]; seq: number }>(`pages/${encodeURIComponent(id)}/updates?since=${since}`),
  send: (id: string, updates: string[]) => call<{ seq: number }>(`pages/${encodeURIComponent(id)}/updates`, { method: "POST", body: { updates } }),
}

const b64 = (bytes: Uint8Array) => {
  let s = ""
  for (const byte of bytes) s += String.fromCharCode(byte)
  return btoa(s)
}
const unb64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0))

const REMOTE = "remote"
const FLUSH_MS = 50
const POLL_MS = 5_000
const RETRY_MS = [1_000, 2_000, 5_000, 10_000, 30_000]
// Cursor colours: neutral and warm only (no blue or purple).
const COLORS = ["#dc2626", "#525252", "#b45309", "#15803d", "#0f766e", "#be123c", "#78716c"]

export function colorFor(id: string) {
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return COLORS[Math.abs(hash) % COLORS.length]
}

type Events = {
  status: (status: LiveStatus) => void
  readOnly: (readOnly: boolean) => void
  seed: () => void // this browser should load the saved markdown into the empty page
  synced: () => void
}

/**
 * Connects a Y.Doc to the relay. The editor binds to `doc` and `awareness`
 * (Tiptap's Collaboration and CollaborationCaret extensions). Local changes go out
 * batched; remote ones come in with origin "remote". While the socket is down it
 * polls and sends over HTTPS, so nothing typed is lost.
 */
export class LiveProvider {
  readonly doc = new Y.Doc()
  readonly awareness = new Awareness(this.doc)
  private socket: WebSocket | null = null
  private seq = 0
  private pending: Uint8Array[] = []
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private retry = 0
  private closed = false
  private who = new Map<number, Who>() // awareness client id → name from the server
  private listeners: { [K in keyof Events]: Events[K][] } = { status: [], readOnly: [], seed: [], synced: [] }

  constructor(readonly pageId: string) {
    this.doc.on("update", (update: Uint8Array, origin: unknown) => {
      if (origin === REMOTE) return
      this.pending.push(update)
      this.flushTimer ??= setTimeout(() => void this.flush(), FLUSH_MS)
    })
    this.awareness.on("update", ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
      if (origin === REMOTE) return
      const changed = [...added, ...updated, ...removed]
      const ws = this.socket
      if (ws?.readyState === WebSocket.OPEN && changed.includes(this.doc.clientID)) {
        ws.send(JSON.stringify({ action: "awareness", update: b64(encodeAwarenessUpdate(this.awareness, [this.doc.clientID])) }))
      }
    })
  }

  on<K extends keyof Events>(event: K, fn: Events[K]) {
    this.listeners[event].push(fn)
    return () => {
      this.listeners[event] = this.listeners[event].filter((f) => f !== fn) as never
    }
  }
  private emit<K extends keyof Events>(event: K, ...args: Parameters<Events[K]>) {
    for (const fn of this.listeners[event]) (fn as (...a: Parameters<Events[K]>) => void)(...args)
  }

  private applyRemote(updates: string[], snapshot?: string | null, seq?: number) {
    Y.transact(
      this.doc,
      () => {
        if (snapshot) Y.applyUpdate(this.doc, unb64(snapshot), REMOTE)
        for (const u of updates) Y.applyUpdate(this.doc, unb64(u), REMOTE)
      },
      REMOTE
    )
    if (seq) this.seq = Math.max(this.seq, seq)
  }

  private async flush() {
    this.flushTimer = null
    if (!this.pending.length) return
    const merged = b64(Y.mergeUpdates(this.pending.splice(0)))
    const ws = this.socket
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: "update", updates: [merged] }))
      return
    }
    try {
      const out = await docsLiveApi.send(this.pageId, [merged])
      this.seq = Math.max(this.seq, out.seq)
    } catch {
      // Keep it; the next flush retries. Yjs ignores updates it already has.
      this.pending.unshift(unb64(merged))
      this.flushTimer ??= setTimeout(() => void this.flush(), POLL_MS)
    }
  }

  private async poll() {
    try {
      const page = await docsLiveApi.updates(this.pageId, this.seq)
      this.applyRemote(page.updates, page.snapshot, page.seq)
    } catch {
      // the next poll or the socket catches up
    }
  }

  async connect() {
    if (this.closed) return
    this.emit("status", this.seq ? "reconnecting" : "connecting")
    let session: Session
    try {
      session = await docsLiveApi.session(this.pageId)
    } catch (error) {
      if (error instanceof LiveError && (error.code === "feature_disabled" || error.status === 404 || error.status === 403)) {
        this.emit("status", "off")
        return
      }
      return this.scheduleRetry()
    }
    this.emit("readOnly", session.read_only)
    const ws = new WebSocket(session.url, session.protocols)
    this.socket = ws
    ws.onopen = () => {
      this.retry = 0
      if (this.pollTimer) clearInterval(this.pollTimer)
      this.pollTimer = null
      ws.send(JSON.stringify({ action: "join", since: this.seq }))
      this.awareness.setLocalState(this.awareness.getLocalState()) // re-announce my cursor
    }
    ws.onmessage = (event) => {
      let m: { type?: string; updates?: string[]; snapshot?: string; seq?: number; initial?: boolean; seed?: boolean; update?: string; who?: Who }
      try {
        m = JSON.parse(String(event.data))
      } catch {
        return
      }
      if (m.type === "snapshot" && m.snapshot) this.applyRemote([], m.snapshot, m.seq)
      else if (m.type === "updates" && m.updates) {
        this.applyRemote(m.updates, null, m.seq)
        if (m.initial) {
          this.emit("status", "live")
          this.emit("synced")
          if (m.seed) this.emit("seed")
          void this.flush()
        }
      } else if (m.type === "ack" && m.seq) this.seq = Math.max(this.seq, m.seq)
      else if (m.type === "awareness" && m.update && m.who) this.applyAwareness(m.update, m.who)
    }
    ws.onclose = () => {
      if (this.socket === ws) this.socket = null
      if (this.closed) return
      this.emit("status", "reconnecting")
      this.pollTimer ??= setInterval(() => {
        void this.poll()
        void this.flush()
      }, POLL_MS)
      this.scheduleRetry()
    }
  }

  // Cursor names come from the server, never from another browser's own claim.
  private applyAwareness(update: string, who: Who) {
    const before = new Set(this.awareness.getStates().keys())
    applyAwarenessUpdate(this.awareness, unb64(update), REMOTE)
    for (const id of this.awareness.getStates().keys()) {
      if (id === this.doc.clientID) continue
      if (!before.has(id) || !this.who.has(id)) this.who.set(id, who)
      const state = this.awareness.getStates().get(id)
      const known = this.who.get(id)
      if (state && known) state.user = { name: known.name ?? known.id, color: colorFor(known.id) }
    }
  }

  private scheduleRetry() {
    if (this.closed) return
    this.emit("status", "reconnecting")
    this.retryTimer = setTimeout(() => void this.connect(), RETRY_MS[Math.min(this.retry++, RETRY_MS.length - 1)])
  }

  /** One browser in the room saves markdown versions: the lowest awareness id. */
  isSaver() {
    const ids = [...this.awareness.getStates().keys()]
    return ids.length === 0 || Math.min(...ids) === this.doc.clientID
  }

  destroy() {
    this.closed = true
    if (this.flushTimer) clearTimeout(this.flushTimer)
    if (this.pollTimer) clearInterval(this.pollTimer)
    if (this.retryTimer) clearTimeout(this.retryTimer)
    removeAwarenessStates(this.awareness, [this.doc.clientID], "local")
    this.socket?.close()
    this.socket = null
    this.awareness.destroy()
    this.doc.destroy()
  }
}
