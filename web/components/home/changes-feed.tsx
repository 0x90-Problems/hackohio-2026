"use client"

import { useEffect, useState } from "react"

import type { Event } from "@/lib/types"
import { MOCK_NOW, events, incomingEvents } from "@/lib/mock-data"
import { describeEvent, eventId, timeAgo } from "@/lib/format"
import { useMockLoading } from "@/lib/use-mock-loading"
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

const initialRows: Row[] = events
  .filter((e) => MOCK_NOW.getTime() - e.created_at.getTime() <= DAY_MS)
  .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
  .map((event) => ({ id: eventId(event), event }))

export function ChangesFeed() {
  const loading = useMockLoading()
  const [rows, setRows] = useState<Row[]>(initialRows)

  // Demo: new events stream in one at a time after the page loads.
  useEffect(() => {
    if (loading) return
    const timers = incomingEvents.map((event, i) =>
      setTimeout(() => {
        setRows((current) => [{ id: eventId(event), event, isNew: true }, ...current])
      }, 3000 + i * 3000)
    )
    return () => timers.forEach(clearTimeout)
  }, [loading])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent changes</CardTitle>
        <CardDescription>Last 24 hours, newest first</CardDescription>
        <CardAction>
          <LiveDot label="Live" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <FeedList
          items={rows}
          pageSize={6}
          loading={loading}
          renderItem={({ event }) => (
            <div className="flex flex-col gap-1.5 py-3">
              <div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                <ActorBadge actor={event.actor} className="text-xs text-foreground" />
                <span className="shrink-0">· {timeAgo(event.created_at)}</span>
              </div>
              <p className="text-sm">{describeEvent(event)}</p>
            </div>
          )}
        />
      </CardContent>
    </Card>
  )
}
