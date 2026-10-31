"use client"

import { chatApi, ChatError } from "@/lib/chat-api"

// Live chat: a doorbell, not a delivery path (docs/chat-plan.md §8a). The socket only says
// "this channel changed", and the page fetches it over HTTP. Pushes can be lost, so the page
// also keeps polling, just far less often while connected. Nothing is sent but a keepalive.

export type Activity = { channel_id: string; last_msg_id?: string }

const KEEPALIVE_MS = 8 * 60_000 // API Gateway drops a connection idle for 10 minutes
const RETRY_MS = [2_000, 5_000, 10_000, 30_000, 60_000]
const OFF_RETRY_MS = 5 * 60_000 // switched off: look again now and then, in case it's back

export class ChatLive {
  private socket: WebSocket | null = null
  private retry = 0
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private keepalive: ReturnType<typeof setInterval> | null = null
  private running = false
  private activity = new Set<(event: Activity) => void>()
  private status = new Set<(connected: boolean) => void>()

  onActivity(fn: (event: Activity) => void) {
    this.activity.add(fn)
    return () => void this.activity.delete(fn)
  }

  onStatus(fn: (connected: boolean) => void) {
    this.status.add(fn)
    return () => void this.status.delete(fn)
  }

  private setConnected(connected: boolean) {
    for (const fn of this.status) fn(connected)
  }

  private later(ms: number) {
    if (!this.running) return
    this.retryTimer = setTimeout(() => void this.connect(), ms)
  }

  start() {
    if (this.running) return
    this.running = true
    void this.connect()
  }

  stop() {
    this.running = false
    if (this.retryTimer) clearTimeout(this.retryTimer)
    if (this.keepalive) clearInterval(this.keepalive)
    this.keepalive = null
    this.socket?.close()
    this.socket = null
  }

  private async connect() {
    if (!this.running) return
    let session: Awaited<ReturnType<typeof chatApi.liveSession>>
    try {
      session = await chatApi.liveSession()
    } catch (error) {
      // Off (or not deployed yet): the page just keeps polling at its normal rate.
      const off = error instanceof ChatError && (error.code === "feature_disabled" || error.status === 403 || error.status === 404)
      return this.later(off ? OFF_RETRY_MS : this.nextRetry())
    }
    if (!this.running) return
    let ws: WebSocket
    try {
      ws = new WebSocket(session.url, session.protocols)
    } catch {
      return this.later(this.nextRetry())
    }
    this.socket = ws
    ws.onopen = () => {
      this.retry = 0
      this.setConnected(true)
      this.keepalive = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ action: "ping" }))
      }, KEEPALIVE_MS)
    }
    ws.onmessage = (event) => {
      let message: { type?: unknown; channel_id?: unknown; last_msg_id?: unknown }
      try {
        message = JSON.parse(String(event.data))
      } catch {
        return
      }
      if (message.type !== "activity" || typeof message.channel_id !== "string") return
      const activity: Activity = { channel_id: message.channel_id }
      if (typeof message.last_msg_id === "string") activity.last_msg_id = message.last_msg_id
      for (const fn of this.activity) fn(activity)
    }
    ws.onclose = () => {
      if (this.keepalive) clearInterval(this.keepalive)
      this.keepalive = null
      if (this.socket === ws) this.socket = null
      this.setConnected(false)
      this.later(this.nextRetry())
    }
  }

  private nextRetry() {
    return RETRY_MS[Math.min(this.retry++, RETRY_MS.length - 1)]
  }
}

/**
 * A burst of pushes becomes one run at a time, at most one per `gapMs`, and a push during a
 * run always gets a run after it, so the last change is never missed.
 */
export function coalesce(run: () => void | Promise<unknown>, gapMs: number) {
  let running = false
  let wanted = false
  let lastStart = -Infinity
  let timer: ReturnType<typeof setTimeout> | null = null
  let stopped = false

  const start = () => {
    timer = null
    if (stopped) return
    if (running) {
      wanted = true
      return
    }
    running = true
    wanted = false
    lastStart = Date.now()
    void Promise.resolve()
      .then(run)
      .catch(() => undefined)
      .finally(() => {
        running = false
        if (wanted) kick()
      })
  }

  const kick = () => {
    if (stopped || timer) return
    if (running) {
      wanted = true
      return
    }
    timer = setTimeout(start, Math.max(0, lastStart + gapMs - Date.now()))
  }

  kick.stop = () => {
    stopped = true
    if (timer) clearTimeout(timer)
  }
  return kick
}
