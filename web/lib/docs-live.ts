"use client"

import * as Y from "yjs"
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from "y-protocols/awareness"

import { readSession } from "@/lib/board-auth"
import { isSaverIn } from "@/lib/docs-saver"
import { teamFetch } from "@/lib/team-choice"

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

async function call<T>(path: string, init: { method?: string; body?: unknown; keepalive?: boolean } = {}): Promise<T> {
  const session = readSession()
  const headers: Record<string, string> = { accept: "application/json" }
  if (session?.secret) headers.authorization = `Bearer ${session.secret}`
  if (init.body !== undefined) headers["content-type"] = "application/json"
  let response: Response
  try {
    response = await teamFetch(`/api/docs-live/${path}`, {
      method: init.method ?? "GET",
      headers,
      cache: "no-store",
      keepalive: init.keepalive,
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
  send: (id: string, updates: string[], keepalive = false) =>
    call<{ seq: number }>(`pages/${encodeURIComponent(id)}/updates`, { method: "POST", body: { updates }, keepalive }),
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
// Every socket message is a Lambda call, and a throttled one is simply dropped.
const AWARENESS_MS = 300 // cursors: losing one is harmless, so just send fewer
const ACK_TIMEOUT_MS = 8_000 // edits: resend until the relay confirms it stored them
const THROTTLED_RETRY_MS = 1_000
const CATCH_UP_EVERY = 6 // polls with no known gap: one in six, about every 30 s
// API Gateway drops a socket over a 32 KB frame; bigger edits go over HTTPS instead.
const MAX_SOCKET_B64 = 24 * 1024
const MAX_KEEPALIVE_B64 = 60 * 1024
const NOT_RETRYABLE = ["too_large", "invalid_update", "read_only"]
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
  rejected: () => void // the relay refused an edit (too large); it won't reach anyone else
}

/**
 * Connects a Y.Doc to the relay. The editor binds to `doc` and `awareness`
 * (Tiptap's Collaboration and CollaborationCaret extensions). Local changes go out
 * batched, one send at a time, and each is resent until the relay acks it; a change
 * lost on the way would hold back everything built on it. Remote ones come in with
 * origin "remote". While the socket is down it polls and sends over HTTPS.
 */
export class LiveProvider {
  readonly doc = new Y.Doc()
  readonly awareness = new Awareness(this.doc)
  private socket: WebSocket | null = null
  private seq = 0 // everything up to here has arrived, with no gaps
  private seen = new Set<number>() // arrived ahead of a gap
  private pending: Uint8Array[] = []
  private inflight: { id: string; update: string; overSocket: boolean } | null = null
  private sends = 0
  private joined = false
  private ticks = 0
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private ackTimer: ReturnType<typeof setTimeout> | null = null
  private joinTimer: ReturnType<typeof setTimeout> | null = null
  private awarenessTimer: ReturnType<typeof setTimeout> | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private catchUpTimer: ReturnType<typeof setInterval> | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private retry = 0
  private closed = false
  private canEdit = true // until the relay says; the editor doesn't save a read-only page anyway
  private who = new Map<number, Who>() // awareness client id → name from the server
  private listeners: { [K in keyof Events]: Events[K][] } = { status: [], readOnly: [], seed: [], synced: [], rejected: [] }

  constructor(readonly pageId: string) {
    this.doc.on("update", (update: Uint8Array, origin: unknown) => {
      if (origin === REMOTE) return
      this.pending.push(update)
      this.flushTimer ??= setTimeout(() => void this.flush(), FLUSH_MS)
    })
    this.awareness.on("update", ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
      if (origin === REMOTE) return
      const me = this.doc.clientID
      if (removed.includes(me)) return this.sendAwareness() // leaving: others drop my cursor now
      if (![...added, ...updated].includes(me)) return
      this.awarenessTimer ??= setTimeout(() => {
        this.awarenessTimer = null
        this.sendAwareness()
      }, AWARENESS_MS)
    })
  }

  private sendAwareness() {
    const ws = this.socket
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: "awareness", update: b64(encodeAwarenessUpdate(this.awareness, [this.doc.clientID])) }))
    }
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

  private applyRemote(updates: string[], snapshot?: string | null) {
    Y.transact(
      this.doc,
      () => {
        if (snapshot) Y.applyUpdate(this.doc, unb64(snapshot), REMOTE)
        for (const u of updates) Y.applyUpdate(this.doc, unb64(u), REMOTE)
      },
      REMOTE
    )
  }

  /** The server says everything up to `seq` has been sent to us. */
  private caughtUp(seq = 0) {
    this.seq = Math.max(this.seq, seq)
    this.advance()
  }

  /** One message arrived. Pushes can come out of order or not at all, so `seq` only moves over an unbroken run. */
  private saw(top: number, count: number) {
    for (let s = top - count + 1; s <= top; s++) this.seen.add(s)
    this.advance()
  }

  private advance() {
    while (this.seen.delete(this.seq + 1)) this.seq++
    for (const s of this.seen) if (s <= this.seq) this.seen.delete(s)
  }

  private settle() {
    this.inflight = null
    if (this.ackTimer) clearTimeout(this.ackTimer)
    this.ackTimer = null
  }

  private async flush() {
    if (this.flushTimer) clearTimeout(this.flushTimer)
    this.flushTimer = null
    if (this.closed || this.inflight || !this.pending.length) return
    const ws = this.socket
    const open = ws?.readyState === WebSocket.OPEN
    if (open && !this.joined) return // the join's reply flushes
    const update = b64(Y.mergeUpdates(this.pending.splice(0)))
    const id = `${this.doc.clientID}-${++this.sends}`
    if (open && update.length <= MAX_SOCKET_B64) {
      this.inflight = { id, update, overSocket: true }
      this.sendInflight()
      return
    }
    this.inflight = { id, update, overSocket: false }
    try {
      const out = await docsLiveApi.send(this.pageId, [update])
      this.saw(out.seq, 1)
      this.settle()
      void this.flush()
    } catch (error) {
      this.settle()
      if (error instanceof LiveError && (error.status === 413 || error.status === 422)) {
        this.emit("rejected")
        return
      }
      // Keep it; the next flush retries. Yjs ignores updates it already has.
      this.pending.unshift(unb64(update))
      if (!this.closed) this.flushTimer ??= setTimeout(() => void this.flush(), POLL_MS)
    }
  }

  private sendInflight(afterMs = ACK_TIMEOUT_MS) {
    const ws = this.socket
    if (!this.inflight?.overSocket || ws?.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ action: "update", id: this.inflight.id, updates: [this.inflight.update] }))
    this.resendAfter(afterMs)
  }

  private resendAfter(ms: number) {
    if (this.ackTimer) clearTimeout(this.ackTimer)
    this.ackTimer = setTimeout(() => this.sendInflight(), ms)
  }

  private sendJoin(ws: WebSocket) {
    ws.send(JSON.stringify({ action: "join", since: this.seq }))
    this.joinTimer = setTimeout(() => {
      if (!this.joined && this.socket === ws && ws.readyState === WebSocket.OPEN) this.sendJoin(ws)
    }, ACK_TIMEOUT_MS)
  }

  /** Best effort as the page goes away: anything not yet confirmed, over a request that outlives it. */
  private sendLast = () => {
    const parts = [...(this.inflight ? [unb64(this.inflight.update)] : []), ...this.pending]
    if (!parts.length) return
    const update = b64(Y.mergeUpdates(parts))
    if (update.length <= MAX_KEEPALIVE_B64) void docsLiveApi.send(this.pageId, [update], true).catch(() => undefined)
  }

  private async poll() {
    try {
      const page = await docsLiveApi.updates(this.pageId, this.seq)
      this.applyRemote(page.updates, page.snapshot)
      this.caughtUp(page.seq)
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
    this.canEdit = !session.read_only
    this.awareness.setLocalStateField("can_edit", this.canEdit) // before the socket opens, so it goes out with the first announce
    window.addEventListener("pagehide", this.sendLast)
    // A push to this window can be dropped too: look for gaps, and check now and then anyway.
    this.catchUpTimer ??= setInterval(() => {
      const quiet = ++this.ticks % CATCH_UP_EVERY !== 0
      if (this.joined && this.socket?.readyState === WebSocket.OPEN && (this.seen.size > 0 || !quiet)) void this.poll()
    }, POLL_MS)
    const ws = new WebSocket(session.url, session.protocols)
    this.socket = ws
    ws.onopen = () => {
      this.retry = 0
      this.joined = false
      if (this.pollTimer) clearInterval(this.pollTimer)
      this.pollTimer = null
      this.sendJoin(ws)
      this.awareness.setLocalState(this.awareness.getLocalState()) // re-announce my cursor
    }
    ws.onmessage = (event) => {
      let m: { type?: string; id?: string; code?: string; message?: string; updates?: string[]; snapshot?: string; seq?: number; initial?: boolean; seed?: boolean; update?: string; who?: Who }
      try {
        m = JSON.parse(String(event.data))
      } catch {
        return
      }
      if (m.type === "snapshot" && m.snapshot) {
        this.applyRemote([], m.snapshot)
        this.caughtUp(m.seq)
      } else if (m.type === "updates" && m.updates) {
        this.applyRemote(m.updates)
        if (m.initial) {
          this.caughtUp(m.seq)
          this.joined = true
          if (this.joinTimer) clearTimeout(this.joinTimer)
          this.emit("status", "live")
          this.emit("synced")
          if (m.seed) this.emit("seed")
          void this.flush()
        } else if (m.seq) this.saw(m.seq, m.updates.length)
      } else if (m.type === "ack" && m.seq) {
        this.saw(m.seq, 1)
        if (!m.id || m.id === this.inflight?.id) {
          this.settle()
          void this.flush()
        }
      } else if (m.type === "error" && m.code && NOT_RETRYABLE.includes(m.code)) {
        // Resending can't help. Everything else is retried by the ack timer.
        this.settle()
        if (m.code !== "read_only") this.emit("rejected")
        void this.flush()
      } else if (m.type === "awareness" && m.update && m.who) this.applyAwareness(m.update, m.who)
      // API Gateway's own reply when the relay couldn't run (usually throttled): no type.
      else if (!m.type && m.message && this.inflight?.overSocket) this.resendAfter(THROTTLED_RETRY_MS)
    }
    ws.onclose = () => {
      if (this.socket === ws) this.socket = null
      this.joined = false
      if (this.joinTimer) clearTimeout(this.joinTimer)
      if (this.closed) return
      if (this.inflight?.overSocket) {
        this.pending.unshift(unb64(this.inflight.update))
        this.settle()
      }
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

  /** One browser in the room saves markdown versions, and it has to be one that can edit. */
  isSaver() {
    return isSaverIn(this.doc.clientID, this.canEdit, this.awareness.getStates())
  }

  destroy() {
    this.sendLast()
    this.closed = true
    window.removeEventListener("pagehide", this.sendLast)
    if (this.flushTimer) clearTimeout(this.flushTimer)
    if (this.ackTimer) clearTimeout(this.ackTimer)
    if (this.joinTimer) clearTimeout(this.joinTimer)
    if (this.awarenessTimer) clearTimeout(this.awarenessTimer)
    if (this.pollTimer) clearInterval(this.pollTimer)
    if (this.catchUpTimer) clearInterval(this.catchUpTimer)
    if (this.retryTimer) clearTimeout(this.retryTimer)
    removeAwarenessStates(this.awareness, [this.doc.clientID], "local")
    this.socket?.close()
    this.socket = null
    this.awareness.destroy()
    this.doc.destroy()
  }
}
