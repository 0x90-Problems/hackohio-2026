"use client"

import { useEffect, useSyncExternalStore } from "react"
import { toast } from "sonner"

import { endSession, readSession, readSessionExpiry, subscribeAuth } from "@/lib/board-auth"
import { refusedReason, sessionPhase, WARN_MS } from "@/lib/session-expiry"

const TOAST_ID = "session-ending"
const PROBE_EVERY_MS = 5 * 60_000
const PROBE_GAP_MS = 60_000

const noExpiry = () => null

function clock(at: number) {
  return new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

/**
 * Tells the person before their session ends, and signs them out with a reason when it does.
 * Without it an expired or revoked session only showed as saves that stopped working.
 */
export function SessionWatch() {
  const expiresAt = useSyncExternalStore(subscribeAuth, readSessionExpiry, noExpiry)

  // The session's own clock: warn ten minutes ahead, sign out at the end.
  useEffect(() => {
    if (expiresAt === null) return
    const check = () => {
      const phase = sessionPhase(expiresAt, Date.now())
      if (phase === "expired") {
        toast.dismiss(TOAST_ID)
        endSession("expired")
      } else if (phase === "soon") {
        toast.warning(`You'll be signed out at ${clock(expiresAt)}`, {
          id: TOAST_ID,
          duration: Infinity,
          description: "Your session is about to end. Sign in again now to keep working without a break.",
          action: { label: "Sign in again", onClick: () => endSession("renew") },
        })
      }
    }
    check()
    const now = Date.now()
    const timers = [expiresAt - WARN_MS - now, expiresAt - now + 500].filter((delay) => delay > 0).map((delay) => window.setTimeout(check, delay))
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
      toast.dismiss(TOAST_ID)
    }
  }, [expiresAt])

  // Ask the board now and then, and when the tab comes back: timers don't run while a laptop
  // sleeps, and a revoked session has no clock to watch.
  useEffect(() => {
    let last = 0
    let stopped = false
    const probe = async () => {
      if (document.visibilityState !== "visible" || Date.now() - last < PROBE_GAP_MS) return
      last = Date.now()
      const secret = readSession()?.secret
      if (!secret) return
      if (sessionPhase(readSessionExpiry(), Date.now()) === "expired") return endSession("expired")
      try {
        const response = await fetch("/api/session", { cache: "no-store", headers: { authorization: `Bearer ${secret}` } })
        if (response.status !== 401 || stopped) return
        const body = (await response.json().catch(() => null)) as { error?: { code?: unknown } } | null
        const reason = refusedReason(response.status, body?.error?.code)
        // Only the session that was asked about: they may have signed in again meanwhile.
        if (reason && readSession()?.secret === secret) endSession(reason)
      } catch {
        // offline or the board is down: not a sign-out
      }
    }
    const onChange = () => void probe()
    const interval = window.setInterval(onChange, PROBE_EVERY_MS)
    window.addEventListener("focus", onChange)
    window.addEventListener("online", onChange)
    document.addEventListener("visibilitychange", onChange)
    onChange()
    return () => {
      stopped = true
      window.clearInterval(interval)
      window.removeEventListener("focus", onChange)
      window.removeEventListener("online", onChange)
      document.removeEventListener("visibilitychange", onChange)
    }
  }, [])

  return null
}
