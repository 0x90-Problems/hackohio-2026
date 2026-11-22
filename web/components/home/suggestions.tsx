"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"

import { ActorBadge } from "@/components/actor-badge"
import { useAuthUser } from "@/components/auth/auth-gate"
import { MarkdownView } from "@/components/markdown-view"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { timeAgo } from "@/lib/format"
import { keepPresent, suggestionHref, suggestionLinkLabel, toggleAll, toggleId } from "@/lib/suggestion-links"
import { type Suggestion, suggestionsApi } from "@/lib/suggestions-api"

const REFRESH_MS = 60_000

/**
 * What your agents suggest you look at or do (NSB-88). Open one to see why; dismiss them one at a
 * time, the ticked ones, or all. Hidden when there's nothing waiting.
 */
export function Suggestions() {
  const account = useAuthUser()
  const [items, setItems] = useState<Suggestion[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [viewing, setViewing] = useState<Suggestion | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const open = await suggestionsApi.open()
      setItems(open)
      setSelected((current) => keepPresent(current, open.map((item) => item._id)))
    } catch {
      // Keep what's shown; an older board without suggestions just shows none.
      setItems((current) => current ?? [])
    }
  }, [])

  useEffect(() => {
    if (!account) return
    // First load on the next tick (not inside the effect), then every minute and on focus.
    const first = window.setTimeout(() => void load(), 0)
    const timer = window.setInterval(() => document.visibilityState === "visible" && void load(), REFRESH_MS)
    const onFocus = () => void load()
    window.addEventListener("focus", onFocus)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(timer)
      window.removeEventListener("focus", onFocus)
    }
  }, [account, load])

  const ids = useMemo(() => (items ?? []).map((item) => item._id), [items])

  const dismiss = async (which: string[] | "all") => {
    if (which !== "all" && which.length === 0) return
    setBusy(true)
    try {
      const { dismissed } = await suggestionsApi.dismiss(which)
      const gone = new Set(dismissed)
      setItems((current) => (which === "all" ? [] : (current ?? []).filter((item) => !gone.has(item._id))))
      setSelected((current) => (which === "all" ? new Set() : new Set([...current].filter((id) => !gone.has(id)))))
      if (viewing && (which === "all" || gone.has(viewing._id))) setViewing(null)
      toast.success(dismissed.length === 1 ? "Dismissed 1 suggestion" : `Dismissed ${dismissed.length} suggestions`)
    } catch (caught) {
      toast.error("Couldn't dismiss", { description: caught instanceof Error ? caught.message : undefined })
      void load()
    } finally {
      setBusy(false)
    }
  }

  const done = async (item: Suggestion) => {
    setBusy(true)
    try {
      await suggestionsApi.done(item._id)
      setItems((current) => (current ?? []).filter((rec) => rec._id !== item._id))
      setViewing(null)
    } catch (caught) {
      toast.error("Couldn't mark it done", { description: caught instanceof Error ? caught.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  if (!account) return null
  if (items !== null && items.length === 0) return null

  const allTicked = ids.length > 0 && ids.every((id) => selected.has(id))

  return (
    <Card aria-busy={items === null}>
      <CardHeader>
        <CardTitle>Suggested by your agents</CardTitle>
        <CardDescription>Things your agents think you should look at.</CardDescription>
        <CardAction>
          <span className="text-xs text-muted-foreground tabular-nums">{items?.length ?? ""}</span>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {items === null ? (
          <div className="flex flex-col gap-3" aria-label="Loading suggestions">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox
                  checked={allTicked ? true : selected.size > 0 ? "indeterminate" : false}
                  onCheckedChange={() => setSelected((current) => toggleAll(current, ids))}
                  aria-label="Select all suggestions"
                />
                {selected.size > 0 ? `${selected.size} selected` : "Select all"}
              </label>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={busy || selected.size === 0} onClick={() => void dismiss([...selected])}>
                  Dismiss selected
                </Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => void dismiss("all")}>
                  Dismiss all
                </Button>
              </div>
            </div>
            <ul className="flex flex-col divide-y">
              {items.map((item) => (
                <li key={item._id} className="flex items-start gap-3 py-2.5 duration-200 animate-in fade-in slide-in-from-top-2 motion-reduce:animate-none">
                  <Checkbox
                    className="mt-1"
                    checked={selected.has(item._id)}
                    onCheckedChange={() => setSelected((current) => toggleId(current, item._id))}
                    aria-label={`Select: ${item.title}`}
                  />
                  <button
                    type="button"
                    onClick={() => setViewing(item)}
                    className="min-w-0 flex-1 rounded-sm text-left focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <span className="block truncate font-medium hover:underline">{item.title}</span>
                    <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                      <ActorBadge actor={item.actor} interactive={false} className="text-xs text-foreground" />
                      <span>· {timeAgo(new Date(item.created_at))}</span>
                    </span>
                  </button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => void dismiss([item._id])} aria-label={`Dismiss: ${item.title}`}>
                    Dismiss
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>

      <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="sm:max-w-xl">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-6">{viewing.title}</DialogTitle>
                <DialogDescription asChild>
                  <span className="flex flex-wrap items-center gap-x-1.5">
                    Suggested by <ActorBadge actor={viewing.actor} interactive={false} className="text-sm text-foreground" />
                    <span>· {timeAgo(new Date(viewing.created_at))}</span>
                  </span>
                </DialogDescription>
              </DialogHeader>
              {viewing.body ? (
                <MarkdownView markdown={viewing.body} compact lineBreaks className="max-h-[50svh] overflow-y-auto" />
              ) : (
                <p className="text-sm text-muted-foreground">No details were given.</p>
              )}
              <DialogFooter className="gap-2 sm:justify-between">
                <Button variant="ghost" disabled={busy} onClick={() => void dismiss([viewing._id])}>
                  Dismiss
                </Button>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" disabled={busy} onClick={() => void done(viewing)}>
                    Mark done
                  </Button>
                  {suggestionHref(viewing.target) && (
                    <Button asChild variant="outline">
                      <Link href={suggestionHref(viewing.target)!} onClick={() => setViewing(null)}>
                        {suggestionLinkLabel(viewing.target)}
                      </Link>
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
