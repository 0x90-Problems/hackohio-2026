import type { Event } from "@/lib/types"
import { describeEvent, eventId, timeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"
import { ActorBadge } from "@/components/actor-badge"
import { LiveDot } from "@/components/live-dot"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

// Right-hand "Live activity" panel. Events marked new slide in from the top.
export function LiveActivity({
  events,
  newIds,
}: {
  events: Event[]
  newIds: Set<string>
}) {
  return (
    <Card className="lg:sticky lg:top-20">
      <CardHeader>
        <CardTitle>Live activity</CardTitle>
        <CardAction>
          <LiveDot label="Streaming" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-80 lg:h-[calc(100svh-14rem)]">
          <ul className="flex flex-col divide-y pr-3">
            {events.map((event) => {
              const id = eventId(event)
              return (
                <li
                  key={id}
                  className={cn(
                    "flex flex-col gap-1 py-2.5",
                    newIds.has(id) && "duration-300 animate-in fade-in slide-in-from-top-2"
                  )}
                >
                  <div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                    <ActorBadge actor={event.actor} className="text-xs text-foreground" />
                    <span className="shrink-0">· {timeAgo(event.created_at)}</span>
                  </div>
                  <p className="text-sm">{describeEvent(event)}</p>
                </li>
              )
            })}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
