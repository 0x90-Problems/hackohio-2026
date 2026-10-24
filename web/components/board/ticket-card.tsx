import Link from "next/link"

import { ACTOR_TYPES } from "@/shared/names"
import type { Ticket } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ActorBadge } from "@/components/actor-badge"

// One card on the board. Agent-made tickets get a dashed border, so humans
// and agents stay easy to tell apart at a glance.
export function TicketCard({ ticket, isNew }: { ticket: Ticket; isNew?: boolean }) {
  const byAgent = ticket.created_by.type === ACTOR_TYPES.AGENT
  return (
    <Link
      href={`/board?ticket=${ticket.key}`}
      scroll={false}
      className={cn(
        "relative flex flex-col gap-2 rounded-xl border bg-card p-3 text-card-foreground shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        byAgent && "border-dashed border-muted-foreground/50",
        ticket.needs_approval && "pl-4",
        isNew && "duration-300 animate-in fade-in zoom-in-95"
      )}
    >
      {/* Solid bar on the left marks a ticket waiting for a human to approve */}
      {ticket.needs_approval && (
        <span className="absolute inset-y-2 left-1.5 w-1 rounded-full bg-foreground" aria-hidden />
      )}
      <div className="flex items-center justify-between gap-2 font-mono text-xs text-muted-foreground">
        <span>{ticket.key}</span>
        {ticket.label && <span>{ticket.label}</span>}
      </div>
      <p className="text-sm leading-snug font-semibold">{ticket.title}</p>
      <ActorBadge actor={ticket.created_by} />
      {ticket.needs_approval && (
        <p className="text-xs font-semibold">Needs human approval</p>
      )}
    </Link>
  )
}
