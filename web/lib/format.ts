import { EVENT_ACTIONS } from "@/shared/names"
import type { Category, Event } from "@/lib/types"
import { categoryName } from "@/lib/categories"
import { tickets } from "@/lib/mock-data"

const absoluteFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
})

export function absoluteTime(date: Date) {
  return absoluteFormat.format(date)
}

// "just now", "6 min", "2 h", "3 d".
export function timeAgo(date: Date, now: Date = new Date()) {
  const minutes = Math.round((now.getTime() - date.getTime()) / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h`
  return `${Math.floor(hours / 24)} d`
}

// One readable sentence for an activity-log event.
export function describeEvent(
  event: Event,
  categories?: Category[],
  boardTickets: readonly { key: string; title: string }[] = tickets
) {
  const key = event.ticket_key
  const to = event.details?.to
  switch (event.action) {
    case EVENT_ACTIONS.TICKET_CREATED: {
      const title = boardTickets.find((t) => t.key === key)?.title
      return title ? `Created ${key} · ${title}` : `Created ${key}`
    }
    case EVENT_ACTIONS.TICKET_MOVED:
      return to ? `Moved ${key} to ${categoryName(to, categories)}` : `Moved ${key}`
    case EVENT_ACTIONS.COMMENT_ADDED:
      return `Commented on ${key}`
    case EVENT_ACTIONS.COMMIT_LINKED:
      return `Linked commit ${event.details?.sha ?? ""} to ${key}`
    case EVENT_ACTIONS.TICKET_CLOSED:
      return `Closed ${key}`
    case EVENT_ACTIONS.TICKET_UPDATED: {
      const change = event.details?.body
      return change ? `Updated ${key} · ${change}` : `Updated ${key}`
    }
    case EVENT_ACTIONS.TICKET_DELETED:
      return `Deleted ${key}`
    default:
      // Never render an empty row for an action this app doesn't know yet.
      return `${String(event.action).replaceAll("_", " ")} · ${key}`
  }
}

// A stable id for an event, for React list keys.
export const eventId = (e: Event) =>
  `${e.action}-${e.ticket_key}-${e.created_at.getTime()}`
