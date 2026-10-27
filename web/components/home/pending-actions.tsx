"use client"

import Link from "next/link"

import { ACTOR_TYPES, TICKET_STATUS } from "@/shared/names"
import type { Ticket } from "@/lib/types"
import { useAuthUser } from "@/components/auth/auth-gate"
import { useProjects } from "@/components/projects/projects-store"
import { ActorBadge } from "@/components/actor-badge"
import { ticketHref } from "@/components/board/ticket-modal"
import { FeedList, type FeedItem } from "@/components/feed-list"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type Row = FeedItem & { ticket: Ticket }

function normalizeStatus(status: string) {
  return status.trim().toLowerCase().replace(/[\s-]+/g, "_")
}

/** Tickets in review that the signed-in person should act on. */
export function pendingReviewTickets(tickets: Ticket[], userId: string) {
  return tickets
    .filter((ticket) => normalizeStatus(ticket.status) === TICKET_STATUS.IN_REVIEW)
    .filter((ticket) => !ticket.reviewer_id || ticket.reviewer_id === userId)
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
}

export function PendingActions() {
  const account = useAuthUser()
  const store = useProjects()
  const rows: Row[] = account
    ? pendingReviewTickets(store.tickets, account._id).map((ticket) => ({
        id: ticket.key,
        ticket,
        isNew: store.newTicketKeys.has(ticket.key),
      }))
    : []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending actions</CardTitle>
        <CardDescription>Waiting on you</CardDescription>
        <CardAction>
          <span className="text-xs text-muted-foreground tabular-nums">
            {rows.length}
          </span>
        </CardAction>
      </CardHeader>
      <CardContent>
        <FeedList
          items={rows}
          pageSize={4}
          loading={false}
          emptyTitle="Nothing waiting on you"
          emptyHint="When a ticket needs your review, it shows up here."
          renderItem={({ ticket }) => <PendingRow ticket={ticket} />}
        />
      </CardContent>
    </Card>
  )
}

function PendingRow({ ticket }: { ticket: Ticket }) {
  const agentMade = ticket.created_by.type === ACTOR_TYPES.AGENT
  return (
    <div className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-muted/60">
      <div className="min-w-0 flex-1">
        <Link
          href={ticketHref(ticket.key)}
          className="font-medium text-foreground hover:underline"
        >
          {agentMade ? "Approve" : "Review"} {ticket.key}
          <span className="text-muted-foreground"> · {ticket.title}</span>
        </Link>
        <div className="mt-1.5">
          <ActorBadge actor={ticket.created_by} interactive={false} />
        </div>
      </div>
      <Button asChild size="sm" variant={agentMade ? "default" : "outline"}>
        <Link href={ticketHref(ticket.key)}>{agentMade ? "Review" : "Open"}</Link>
      </Button>
    </div>
  )
}
