import { motion } from "motion/react"

import { EVENT_ACTIONS } from "@/shared/names"
import type { Comment, Event } from "@/lib/types"
import { eventId } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useShortActorName } from "@/components/actor-badge"

function actionWord(action: Event["action"]): string {
  switch (action) {
    case EVENT_ACTIONS.TICKET_CREATED:
      return "created"
    case EVENT_ACTIONS.TICKET_MOVED:
    case EVENT_ACTIONS.TICKET_CLOSED:
      return "moved"
    case EVENT_ACTIONS.COMMENT_ADDED:
      return "commented"
    case EVENT_ACTIONS.TICKET_UPDATED:
      return "edited"
    case EVENT_ACTIONS.TICKET_DELETED:
      return "deleted"
    case EVENT_ACTIONS.COMMIT_LINKED:
      return "linked"
    default:
      return "changed"
  }
}

// Oldest change is v1. Comments without a body are not versions.
export function numberedCardHistory(events: Event[]) {
  return events
    .filter((event) => event.action !== EVENT_ACTIONS.COMMENT_ADDED || Boolean(event.details?.body))
    .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
    .map((event, index) => ({ event, version: index + 1 }))
}

export function withCommentEvents(events: Event[], comments: Comment[]): Event[] {
  const extras = comments
    .filter(
      (comment) =>
        !events.some(
          (event) =>
            event.action === EVENT_ACTIONS.COMMENT_ADDED &&
            event.details?.body === comment.body &&
            event.created_at.getTime() === comment.created_at.getTime()
        )
    )
    .map(
      (comment): Event => ({
        action: EVENT_ACTIONS.COMMENT_ADDED,
        ticket_key: comment.ticket_key,
        project_key: comment.ticket_key.split("-")[0] ?? "",
        actor: comment.author,
        details: { body: comment.body },
        created_at: comment.created_at,
      })
    )
  return [...events, ...extras]
}

export function versionForComment(events: Event[], comment: Comment): number | undefined {
  return numberedCardHistory(events).find(
    ({ event }) =>
      event.action === EVENT_ACTIONS.COMMENT_ADDED &&
      event.details?.body === comment.body &&
      event.created_at.getTime() === comment.created_at.getTime()
  )?.version
}

function HistoryLine({ event, version }: { event: Event; version: number }) {
  const name = useShortActorName(event.actor)
  const comment = event.action === EVENT_ACTIONS.COMMENT_ADDED
  return (
    <span className="text-sm">
      {name} <span className="text-muted-foreground">[{actionWord(event.action)}]</span>
      {!comment && (
        <span className="ml-2 font-mono text-xs text-muted-foreground">v{version}</span>
      )}
    </span>
  )
}

// One short row per change. Comment text, the long actor badge, and the
// timestamp stay with the comment. Other rows keep a single version number.
export function ChangeHistory({ events }: { events: Event[] }) {
  const versions = numberedCardHistory(events).reverse()

  if (versions.length === 0) {
    return <p className="text-sm text-muted-foreground">No changes yet.</p>
  }

  return (
    <ol className="flex flex-col">
      {versions.map(({ event, version }, index) => {
        const latest = index === 0
        const last = index === versions.length - 1
        return (
          <motion.li
            key={eventId(event)}
            layout="position"
            initial={false}
            className="relative flex gap-3 pb-4 last:pb-0"
          >
            <span className="relative flex w-3 shrink-0 justify-center" aria-hidden>
              <span
                className={cn(
                  "mt-1 size-3 rounded-full border-2 bg-background",
                  latest ? "border-primary bg-primary" : "border-muted-foreground/60",
                  version === 1 && "border-foreground bg-foreground"
                )}
              />
              {!last && <span className="absolute top-4 -bottom-1 w-px bg-border" />}
            </span>
            <HistoryLine event={event} version={version} />
          </motion.li>
        )
      })}
    </ol>
  )
}
