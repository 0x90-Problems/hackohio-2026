"use client"

import { type BoardSettings, type Session, type WireElement, WhiteboardError, whiteboardApi } from "@/lib/whiteboard-api"

// Keeps a board in sync through the whiteboard relay. Every socket message is a Lambda call,
// and a throttled one is simply dropped with no retry from anyone, so a lost edit would never
// reach the board. Here each window sends one batch at a time and resends it until the relay
// acks it, and looks for gaps in what it has received and fetches them.

export type Status = "connecting" | "live" | "reconnecting"
export type Who = { type: "human" | "agent"; id: string; name?: string; acting_for?: string }

type Handlers = {
  onElements: (elements: WireElement[]) => void
  onStatus: (status: Status) => void
  onReadOnly: (readOnly: boolean) => void
  onFailure: (message: string) => void
  onRejected: (message: string) => void // the relay refused an edit, and resending can't help
  onCursor: (connection: string, who: Who, x: number, y: number) => void
  onBoard: (settings: BoardSettings) => void
  onAgent: (who: Who, summary: string, at: { x: number; y: number } | null) => void
  // Pushes can be lost, so nothing may depend on these arriving.
  onSaved?: (version: number, who: Who | null, auto: boolean) => void
  onRestored?: (version: number, savedAs: number | null, who: Who | null) => void
}

const FLUSH_MS = 100 // batch local edits
const CURSOR_MS = 300 // cursors are the cheapest thing to lose, so send fewer
const POLL_MS = 5_000
const ACK_TIMEOUT_MS = 8_000
const THROTTLED_RETRY_MS = 1_000
const CATCH_UP_EVERY = 6 // polls with no known gap: one in six, about every 30 s
const CATCH_UP_OVERLAP = 100 // a seq can be handed out before its element lands
const MAX_BATCH = 50 // server limit per update
// API Gateway drops a socket over a 32 KB frame; a shape too big for that goes over HTTPS.
const MAX_SOCKET_BYTES = 24 * 1024
const MAX_KEEPALIVE_BYTES = 60 * 1024
const RETRY_MS = [1_000, 2_000, 5_000, 10_000, 30_000]
const SETTLE_CHECK_MS = 50
const NOT_RETRYABLE = ["invalid_element", "invalid_input", "too_large", "board_full", "read_only", "invalid_json"]

type Message = {
  type?: string
  id?: string
  code?: string
  message?: string
  elements?: WireElement[]
  seq?: number
  first?: number
  initial?: boolean
  stale?: boolean
  who?: Who
  connection?: string
  x?: number
  y?: number
  summary?: string
  at?: { x: number; y: number } | null
  locked?: boolean
  agents_paused?: boolean
  agents_may_edit_all?: boolean
  version?: number
  saved_as?: number | null
  auto?: boolean
}

export class BoardSync {
  private socket: WebSocket | null = null
  private seq = 0 // everything up to here has arrived, with no gaps
  private seen = new Set<number>() // arrived ahead of a gap
  private pending = new Map<string, WireElement>()
  private inflight: { id: string; batch: WireElement[]; overSocket: boolean } | null = null
  private sends = 0
  private joined = false
  private ticks = 0
  private retry = 0
  private lastCursor = 0
  private closed = false
  private flusher: ReturnType<typeof setInterval> | null = null
  private catchUpTimer: ReturnType<typeof setInterval> | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private ackTimer: ReturnType<typeof setTimeout> | null = null
  private joinTimer: ReturnType<typeof setTimeout> | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly boardId: string,
    private readonly on: Handlers
  ) {}

  async start() {
    window.addEventListener("pagehide", this.sendLast)
    this.flusher = setInterval(() => void this.flush(), FLUSH_MS)
    this.catchUpTimer = setInterval(() => {
      const quiet = ++this.ticks % CATCH_UP_EVERY !== 0
      if (this.joined && this.socket?.readyState === WebSocket.OPEN && (this.seen.size > 0 || !quiet)) void this.poll(true)
    }, POLL_MS)
    await this.poll() // the whole board, before going live
    await this.connect()
  }

  stop() {
    this.sendLast()
    this.closed = true
    window.removeEventListener("pagehide", this.sendLast)
    for (const timer of [this.flusher, this.catchUpTimer, this.pollTimer]) if (timer) clearInterval(timer)
    for (const timer of [this.ackTimer, this.joinTimer, this.retryTimer]) if (timer) clearTimeout(timer)
    this.socket?.close()
    this.socket = null
  }

  isClosed() {
    return this.closed
  }

  /** A local edit to send. The newest version of each shape wins while it waits. */
  queue(element: WireElement) {
    this.pending.set(element.id, element)
  }

  /**
   * Waits until this window's edits have reached the server, so a save includes what was just
   * drawn. Resolves false if they haven't after timeoutMs (offline, say); they'll still get there.
   */
  async settled(timeoutMs = 5_000): Promise<boolean> {
    const until = Date.now() + timeoutMs
    while (this.pending.size || this.inflight) {
      if (this.closed || Date.now() >= until) return false
      await new Promise((resolve) => setTimeout(resolve, SETTLE_CHECK_MS))
    }
    return true
  }

  cursor(x: number, y: number, selected: string[]) {
    const now = Date.now()
    const ws = this.socket
    if (now - this.lastCursor < CURSOR_MS || ws?.readyState !== WebSocket.OPEN) return
    this.lastCursor = now
    ws.send(JSON.stringify({ action: "cursor", x, y, selected }))
  }

  private caughtUp(seq = 0) {
    this.seq = Math.max(this.seq, seq)
    this.advance()
  }

  /** One message's range arrived. Pushes can come out of order or not at all, so `seq` only moves over an unbroken run. */
  private saw(first: number, top: number) {
    for (let s = first; s <= top; s++) this.seen.add(s)
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

  private takeBatch(): WireElement[] {
    const batch: WireElement[] = []
    let size = 0
    for (const element of this.pending.values()) {
      const width = JSON.stringify(element).length
      if (batch.length && (batch.length >= MAX_BATCH || size + width > MAX_SOCKET_BYTES)) break
      batch.push(element)
      size += width
    }
    for (const element of batch) this.pending.delete(element.id)
    return batch
  }

  private async flush() {
    if (this.closed || this.inflight || !this.pending.size) return
    const open = this.socket?.readyState === WebSocket.OPEN
    if (open && !this.joined) return // the join's reply flushes
    const batch = this.takeBatch()
    const id = `${Date.now().toString(36)}-${++this.sends}`
    if (open && JSON.stringify(batch).length <= MAX_SOCKET_BYTES) {
      this.inflight = { id, batch, overSocket: true }
      this.sendInflight()
      return
    }
    this.inflight = { id, batch, overSocket: false }
    try {
      const out = await whiteboardApi.send(this.boardId, batch)
      if (out.stale.length) this.on.onElements(out.stale)
      if (out.first) this.saw(out.first, out.seq)
      this.settle()
    } catch (error) {
      this.settle()
      if (error instanceof WhiteboardError && error.status === 403) {
        this.on.onReadOnly(true)
        return
      }
      if (error instanceof WhiteboardError && (error.status === 413 || error.status === 422)) {
        this.on.onRejected(error.message)
        return
      }
      this.putBack(batch) // the next flush retries; versions only grow, so a retry can't regress anything
    }
  }

  private putBack(batch: WireElement[]) {
    for (const element of batch) if (!this.pending.has(element.id)) this.pending.set(element.id, element)
  }

  private sendInflight(afterMs = ACK_TIMEOUT_MS) {
    const ws = this.socket
    if (!this.inflight?.overSocket || ws?.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ action: "update", id: this.inflight.id, elements: this.inflight.batch }))
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
    const elements = [...(this.inflight?.batch ?? []).filter((el) => !this.pending.has(el.id)), ...this.pending.values()]
    if (!elements.length || elements.length > MAX_BATCH || JSON.stringify(elements).length > MAX_KEEPALIVE_BYTES) return
    void whiteboardApi.send(this.boardId, elements, true).catch(() => undefined)
  }

  private async poll(overlap = false) {
    try {
      let page = await whiteboardApi.elements(this.boardId, overlap ? Math.max(this.seq - CATCH_UP_OVERLAP, 0) : this.seq)
      this.on.onElements(page.elements)
      while (page.next_since !== null) {
        page = await whiteboardApi.elements(this.boardId, page.next_since)
        this.on.onElements(page.elements)
      }
      this.caughtUp(page.seq)
    } catch {
      // stay quiet; the socket or the next poll will catch up
    }
  }

  private scheduleRetry() {
    if (this.closed) return
    this.on.onStatus("reconnecting")
    this.retryTimer = setTimeout(() => void this.connect(), RETRY_MS[Math.min(this.retry++, RETRY_MS.length - 1)])
  }

  private async connect() {
    if (this.closed) return
    let session: Session
    try {
      session = await whiteboardApi.session(this.boardId)
    } catch (error) {
      if (error instanceof WhiteboardError && (error.status === 404 || error.code === "feature_disabled")) {
        this.on.onFailure(error.message)
        return
      }
      this.scheduleRetry()
      return
    }
    if (this.closed) return
    this.on.onReadOnly(session.read_only)
    const ws = new WebSocket(session.url, session.protocols)
    this.socket = ws
    ws.onopen = () => {
      this.retry = 0
      this.joined = false
      if (this.pollTimer) clearInterval(this.pollTimer)
      this.pollTimer = null
      this.sendJoin(ws)
    }
    ws.onmessage = (event) => {
      let message: Message
      try {
        message = JSON.parse(String(event.data))
      } catch {
        return
      }
      this.handle(message)
    }
    ws.onclose = () => {
      if (this.socket === ws) this.socket = null
      this.joined = false
      if (this.joinTimer) clearTimeout(this.joinTimer)
      if (this.closed) return
      if (this.inflight?.overSocket) {
        this.putBack(this.inflight.batch)
        this.settle()
      }
      this.pollTimer ??= setInterval(() => {
        void this.poll()
        void this.flush()
      }, POLL_MS)
      this.scheduleRetry()
    }
  }

  private handle(m: Message) {
    if (m.type === "elements" && m.elements) {
      this.on.onElements(m.elements)
      if (m.initial) {
        this.caughtUp(m.seq)
        this.joined = true
        if (this.joinTimer) clearTimeout(this.joinTimer)
        this.on.onStatus("live")
        void this.flush()
      } else if (m.stale) {
        // Copies of what the server already has: not a new range.
      } else if (m.seq && m.first) this.saw(m.first, m.seq)
      else if (m.seq) this.caughtUp(m.seq) // a relay that doesn't send ranges yet
    } else if (m.type === "ack") {
      if (m.seq && m.first) this.saw(m.first, m.seq)
      else if (m.seq) this.caughtUp(m.seq)
      if (!m.id || m.id === this.inflight?.id) {
        this.settle()
        void this.flush()
      }
    } else if (m.type === "cursor" && m.connection && m.who) {
      this.on.onCursor(m.connection, m.who, m.x ?? 0, m.y ?? 0)
    } else if (m.type === "board") {
      this.on.onBoard({ locked: Boolean(m.locked), agents_paused: Boolean(m.agents_paused), agents_may_edit_all: Boolean(m.agents_may_edit_all) })
    } else if (m.type === "saved" && m.version) {
      this.on.onSaved?.(m.version, m.who ?? null, Boolean(m.auto))
    } else if (m.type === "restored" && m.version) {
      this.on.onRestored?.(m.version, m.saved_as ?? null, m.who ?? null)
    } else if (m.type === "agent" && m.who) {
      this.on.onAgent(m.who, m.summary ?? "", m.at ?? null)
    } else if (m.type === "error") {
      // Everything else is retried by the ack timer.
      if (m.code && NOT_RETRYABLE.includes(m.code)) {
        this.settle()
        this.on.onRejected(m.message ?? "That change couldn't be saved.")
        void this.flush()
      }
    } else if (!m.type && m.message && this.inflight?.overSocket) {
      // API Gateway's own reply when the relay couldn't run (usually throttled): no type.
      this.resendAfter(THROTTLED_RETRY_MS)
    }
  }
}
