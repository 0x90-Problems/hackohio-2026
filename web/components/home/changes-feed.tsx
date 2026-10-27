"use client"

import type { Event } from "@/lib/types"
import { describeEvent, eventId, timeAgo } from "@/lib/format"
import { useProjects } from "@/components/projects/projects-store"
import { ActorBadge } from "@/components/actor-badge"
import { FeedList, type FeedItem } from "@/components/feed-list"
import { LiveDot } from "@/components/live-dot"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type Row = FeedItem & { event: Event }

const DAY_MS = 24 * 60 * 60 * 1000

export function ChangesFeed() {
  const store = useProjects()
  const now = Date.now()
  const rows: Row[] = store.activity
    .filter((event) => now - event.created_at.getTime() <= DAY_MS)
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    .map((event) => ({
      id: eventId(event),
      event,
      isNew: store.newEventIds.has(eventId(event)),
    }))

  return (
    <Card className="lg:sticky lg:top-20">
      <CardHeader>
        <CardTitle>Changes</CardTitle>
        <CardDescription>Last 24 hours, newest first</CardDescription>
        <CardAction>
          <LiveDot label="Live" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <FeedList
          items={rows}
          pageSize={6}
          loading={false}
          emptyTitle="No changes yet"
          emptyHint="Moves, comments, and commits from people and agents show up here."
          renderItem={({ event }) => (
            <div className="flex flex-col gap-1.5 py-3">
              <div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                <ActorBadge actor={event.actor} className="text-xs text-foreground" />
                <span className="shrink-0">· {timeAgo(event.created_at)}</span>
              </div>
              <p className="text-sm">{describeEvent(event, undefined, store.tickets)}</p>
            </div>
          )}
        />
      </CardContent>
    </Card>
  )
}
