"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "motion/react"

import type { Category, Event } from "@/lib/types"
import { describeEvent, eventId, timeAgo } from "@/lib/format"
import { FEED_PAGE, moreRows, rowsAfterNew } from "@/lib/feed-window"
import { ActorBadge } from "@/components/actor-badge"
import { Loader2Icon } from "@/components/icons"
import { EmptyState } from "@/components/illustrations"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

// The project's Changelog tab: every move, comment and commit, newest first. Events marked new
// slide in from the top.
// Shows the newest page of events and adds older ones as you scroll to the bottom.
export function LiveActivity({
  events,
  newIds,
  categories,
  tickets,
}: {
  events: Event[]
  newIds: Set<string>
  categories?: Category[]
  tickets?: readonly { key: string; title: string }[]
}) {
  const [shown, setShown] = useState(() => Math.min(FEED_PAGE, events.length))
  const [seen, setSeen] = useState(events.length)
  const area = useRef<HTMLDivElement>(null)
  const end = useRef<HTMLLIElement>(null)

  // New events arrive at the top; keep the rows already shown in view.
  if (events.length !== seen) {
    setShown((current) => rowsAfterNew(current, seen, events.length))
    setSeen(events.length)
  }

  const more = shown < events.length

  // Reaching the loading row at the bottom adds the next page.
  useEffect(() => {
    const target = end.current
    if (!more || !target) return
    const root = area.current?.querySelector("[data-slot=scroll-area-viewport]") ?? null
    const watcher = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        // One frame later, so the loading row paints before the new rows do.
        requestAnimationFrame(() => setShown((current) => moreRows(current, events.length)))
      },
      { root, rootMargin: "0px 0px 120px 0px" }
    )
    watcher.observe(target)
    return () => watcher.disconnect()
  }, [more, shown, events.length])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Changelog</CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={area}>
        <ScrollArea className="h-[calc(100svh-16rem)] min-h-80 [&_[data-slot=scroll-area-viewport]>div]:!block [&_[data-slot=scroll-area-viewport]>div]:!w-full [&_[data-slot=scroll-area-viewport]>div]:!min-w-0">
          {events.length === 0 ? (
            <EmptyState title="No activity yet" hint="Moves, comments and commits on this board show up here." />
          ) : (
          <ul className="flex flex-col divide-y pr-3" aria-busy={more}>
            {events.slice(0, shown).map((event) => {
              const id = eventId(event)
              return (
                // New events slide down from the top; older ones glide down to make room
                <motion.li
                  key={id}
                  layout="position"
                  initial={newIds.has(id) ? { opacity: 0, y: -12 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  className="flex flex-col gap-1 py-2.5"
                >
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                    <ActorBadge
                      actor={event.actor}
                      wrap
                      className="min-w-0 text-xs text-foreground"
                    />
                    <span className="shrink-0">
                      · {timeAgo(event.created_at)}
                    </span>
                  </div>
                  <p className="text-sm break-words">{describeEvent(event, categories, tickets)}</p>
                </motion.li>
              )
            })}
            {more ? (
              <li ref={end} className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground" role="status">
                <Loader2Icon className="size-3.5 motion-safe:animate-spin" aria-hidden="true" />
                Loading older activity…
              </li>
            ) : events.length > FEED_PAGE ? (
              <li className="py-3 text-center text-xs text-muted-foreground">That&apos;s all the activity on this board.</li>
            ) : null}
          </ul>
          )}
        </ScrollArea>
        </div>
      </CardContent>
    </Card>
  )
}
