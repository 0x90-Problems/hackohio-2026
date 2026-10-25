import { motion } from "motion/react"

import { EVENT_ACTIONS } from "@/shared/names"
import type { Category, Event } from "@/lib/types"
import { categoryName } from "@/lib/categories"
import { eventId, timeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"
import { ActorBadge } from "@/components/actor-badge"

// What each version of a card changed, in a few words
function describeChange(event: Event, categories: Category[]) {
  const to = event.details?.to
  switch (event.action) {
    case EVENT_ACTIONS.TICKET_CREATED:
      return "Card created"
    case EVENT_ACTIONS.TICKET_MOVED:
      return to ? `Status → ${categoryName(to, categories)}` : "Moved"
    case EVENT_ACTIONS.COMMIT_LINKED:
      return `Linked commit ${event.details?.sha ?? ""}`
    case EVENT_ACTIONS.TICKET_CLOSED:
      return to ? `Approved → ${categoryName(to, categories)}` : "Approved"
    case EVENT_ACTIONS.COMMENT_ADDED:
      return event.details?.body ? `Comment: ${event.details.body}` : "Comment added"
    case EVENT_ACTIONS.TICKET_UPDATED:
      return event.details?.body ?? "Edited"
    case EVENT_ACTIONS.TICKET_DELETED:
      return "Deleted"
    default:
      return event.details?.body ?? "Changed"
  }
}

// "Change history" from the Ticket detail wireframe: every change to the card
// as a numbered version (v1 = created), newest first, like commits in Git.
// Built from the events collection, so nothing extra is stored.
export function ChangeHistory({
  events,
  categories,
}: {
  events: Event[]
  categories: Category[]
}) {
  // Comments have their own section, so they aren't versions of the card
  const versions = events
    .filter((e) => e.action !== EVENT_ACTIONS.COMMENT_ADDED || Boolean(e.details?.body))
    .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
    .map((event, i) => ({ event, version: i + 1 }))
    .reverse()

  if (versions.length === 0) {
    return <p className="text-sm text-muted-foreground">No changes yet.</p>
  }

  return (
    <ol className="flex flex-col">
      {versions.map(({ event, version }, i) => {
        const latest = i === 0
        const last = i === versions.length - 1
        return (
          <motion.li
            key={eventId(event)}
            layout="position"
            initial={false}
            className="relative flex gap-3 pb-4 last:pb-0"
          >
            {/* Timeline: a dot per version joined by a line */}
            <span
              className="relative flex w-3 shrink-0 justify-center"
              aria-hidden
            >
              <span
                className={cn(
                  "mt-1 size-3 rounded-full border-2 bg-background",
                  latest
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/60",
                  version === 1 && "border-foreground bg-foreground"
                )}
              />
              {!last && (
                <span className="absolute top-4 -bottom-1 w-px bg-border" />
              )}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-mono text-xs text-muted-foreground">
                v{version} · {timeAgo(event.created_at)}
              </span>
              <span className="text-sm">
                {describeChange(event, categories)}
              </span>
              <ActorBadge
                actor={event.actor}
                className="text-xs text-muted-foreground"
              />
            </div>
          </motion.li>
        )
      })}
    </ol>
  )
}
