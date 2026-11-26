import Link from "next/link"

import { ACTOR_TYPES } from "@/shared/names"
import type { Comment, Ticket } from "@/lib/types"
import { CATEGORY_COLORS } from "@/lib/categories"
import { cn } from "@/lib/utils"
import { ActorBadge } from "@/components/actor-badge"
import { MessageCircleIcon, PaperclipIcon } from "@/components/icons"
import { DeleteCardButton } from "@/components/board/delete-card-button"
import { ticketHref } from "@/components/board/ticket-modal"
import { Badge } from "@/components/ui/badge"

export type CardCounts = { comments: number; attachments: number }

// Comments and attached files per ticket, from the comments the board already loaded. A file
// attached more than once (another version, another comment) counts once.
export function cardCounts(comments: readonly Comment[]): Map<string, CardCounts> {
  const files = new Map<string, Set<string>>()
  const counts = new Map<string, CardCounts>()
  for (const comment of comments) {
    const entry = counts.get(comment.ticket_key) ?? { comments: 0, attachments: 0 }
    entry.comments += 1
    const seen = files.get(comment.ticket_key) ?? new Set<string>()
    for (const attachment of comment.attachments ?? []) seen.add(attachment.file_id)
    files.set(comment.ticket_key, seen)
    entry.attachments = seen.size
    counts.set(comment.ticket_key, entry)
  }
  return counts
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`

// One card on the board. Agent-made tickets get a dashed border, so humans
// and agents stay easy to tell apart at a glance. Delete sits beside the link
// so it is on every card, including a bot's only card.
export function TicketCard({
  ticket,
  isNew,
  onDelete,
  counts,
}: {
  ticket: Ticket
  isNew?: boolean
  onDelete: (ticketKey: string) => void
  counts?: CardCounts
}) {
  const byAgent = ticket.created_by.type === ACTOR_TYPES.AGENT
  return (
    <div
      className={cn(
        "relative flex flex-col gap-2 rounded-xl border bg-card p-3 text-card-foreground shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        ticket.card_color && CATEGORY_COLORS[ticket.card_color].card,
        byAgent && "border-transparent",
        isNew && "animate-in duration-300 zoom-in-95 fade-in"
      )}
    >
      {byAgent && (
        <span
          className="pointer-events-none absolute inset-0 rounded-[inherit] border-2 border-transparent"
          style={{
            backgroundImage:
              "linear-gradient(135deg, rgb(250 204 21 / 0.65), rgb(253 224 71 / 0.12) 50%, rgb(245 158 11 / 0.55))",
            mask: "linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)",
            maskComposite: "exclude",
            WebkitMaskComposite: "xor",
          }}
          aria-hidden="true"
        />
      )}
      <Link
        href={ticketHref(ticket.key)}
        scroll={false}
        draggable={false}
        className="flex flex-col gap-2 pr-16 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <div className="flex items-center justify-between gap-2 font-mono text-xs text-muted-foreground">
          <span>{ticket.key}</span>
          {ticket.approval_request && (
            <Badge variant="outline" className="border-dashed font-sans font-normal">
              Waiting for approval
            </Badge>
          )}
        </div>
        <p className="text-sm leading-snug font-semibold">{ticket.title}</p>
        {!!ticket.tags?.length && (
          <div className="flex flex-wrap gap-1">
            {ticket.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="font-normal">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        <ActorBadge actor={ticket.created_by} interactive={false} />
        {counts && (counts.comments > 0 || counts.attachments > 0) && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums" data-slot="card-counts">
            {counts.comments > 0 && (
              <span className="inline-flex items-center gap-1" aria-label={plural(counts.comments, "comment")} title={plural(counts.comments, "comment")}>
                <MessageCircleIcon className="size-3.5" aria-hidden="true" />
                {counts.comments}
              </span>
            )}
            {counts.attachments > 0 && (
              <span className="inline-flex items-center gap-1" aria-label={plural(counts.attachments, "attachment")} title={plural(counts.attachments, "attachment")}>
                <PaperclipIcon className="size-3.5" aria-hidden="true" />
                {counts.attachments}
              </span>
            )}
          </div>
        )}
      </Link>
      <DeleteCardButton
        ticketKey={ticket.key}
        onDelete={onDelete}
        className="absolute top-2 right-2 z-10"
      />
    </div>
  )
}
