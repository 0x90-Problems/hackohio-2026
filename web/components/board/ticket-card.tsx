import Link from "next/link"

import { ACTOR_TYPES } from "@/shared/names"
import type { Ticket } from "@/lib/types"
import { CATEGORY_COLORS } from "@/lib/categories"
import { cn } from "@/lib/utils"
import { ActorBadge } from "@/components/actor-badge"
import { ticketHref } from "@/components/board/ticket-modal"
import { Badge } from "@/components/ui/badge"

// One card on the board. Agent-made tickets get a dashed border, so humans
// and agents stay easy to tell apart at a glance.
export function TicketCard({
  ticket,
  isNew,
}: {
  ticket: Ticket
  isNew?: boolean
}) {
  const byAgent = ticket.created_by.type === ACTOR_TYPES.AGENT
  return (
    <Link
      href={ticketHref(ticket.key)}
      scroll={false}
      // The wrapper on the board handles dragging, not the link itself
      draggable={false}
      className={cn(
        "relative flex flex-col gap-2 rounded-xl border bg-card p-3 text-card-foreground shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        ticket.card_color && CATEGORY_COLORS[ticket.card_color].card,
        byAgent && "border-transparent",
        ticket.needs_approval && "pl-4",
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
      {/* Solid bar on the left marks a ticket waiting for a human to approve */}
      {ticket.needs_approval && (
        <span
          className="absolute inset-y-2 left-1.5 w-1 rounded-full bg-foreground"
          aria-hidden
        />
      )}
      <div className="flex items-center justify-between gap-2 font-mono text-xs text-muted-foreground">
        <span>{ticket.key}</span>
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
      <ActorBadge actor={ticket.created_by} />
      {ticket.needs_approval && (
        <p className="text-xs font-semibold">Needs human approval</p>
      )}
    </Link>
  )
}
