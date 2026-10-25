import { motion } from "motion/react"

import type { Category, Event } from "@/lib/types"
import { describeEvent, eventId, timeAgo } from "@/lib/format"
import { ActorBadge } from "@/components/actor-badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

// Right-hand "Live activity" panel. Events marked new slide in from the top.
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
  return (
    <Card className="lg:sticky lg:top-20">
      <CardHeader>
        <CardTitle>Live activity</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-80 lg:h-[calc(100svh-14rem)] [&_[data-slot=scroll-area-viewport]>div]:!block [&_[data-slot=scroll-area-viewport]>div]:!w-full [&_[data-slot=scroll-area-viewport]>div]:!min-w-0">
          {events.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">No activity yet.</p>
          ) : (
          <ul className="flex flex-col divide-y pr-3">
            {events.map((event) => {
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
          </ul>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
