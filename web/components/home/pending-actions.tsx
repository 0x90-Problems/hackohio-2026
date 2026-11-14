"use client"

import Link from "next/link"

import { TICKET_STATUS } from "@/shared/names"
import type { Ticket } from "@/lib/types"
import { approvalsWaitingOn } from "@/lib/approval"
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

type Row = FeedItem & { ticket: Ticket; approval: boolean }

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

/**
 * Everything waiting on this person: closes they can approve, then tickets in review for them.
 * The board only sends tickets in projects they're on, so every approval here is theirs to see.
 */
export function waitingOnYou(tickets: Ticket[], account: { _id: string; admin?: boolean }) {
  const approvals = approvalsWaitingOn(tickets, { id: account._id, admin: account.admin === true })
  const asked = new Set(approvals.map((ticket) => ticket.key))
  const reviews = pendingReviewTickets(tickets, account._id).filter((ticket) => !asked.has(ticket.key))
  return { approvals, reviews }
}

export function PendingActions() {
  const account = useAuthUser()
  const store = useProjects()
  const { approvals, reviews } = account ? waitingOnYou(store.tickets, account) : { approvals: [], reviews: [] }
  const rows: Row[] = [
    ...approvals.map((ticket) => ({ id: ticket.key, ticket, approval: true, isNew: store.newTicketKeys.has(ticket.key) })),
    ...reviews.map((ticket) => ({ id: ticket.key, ticket, approval: false, isNew: store.newTicketKeys.has(ticket.key) })),
  ]

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
          emptyHint="When a ticket needs your review or approval, it shows up here."
          renderItem={({ ticket, approval }) =>
            approval ? <ApprovalRow ticket={ticket} /> : <PendingRow ticket={ticket} />
          }
        />
      </CardContent>
    </Card>
  )
}

function ApprovalRow({ ticket }: { ticket: Ticket }) {
  const request = ticket.approval_request
  if (!request) return null
  return (
    <div className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-muted/60">
      <div className="min-w-0 flex-1">
        <Link
          href={ticketHref(ticket.key)}
          className="font-medium text-foreground hover:underline"
        >
          Approve closing {ticket.key}
          <span className="text-muted-foreground"> · {ticket.title}</span>
        </Link>
        <div className="mt-1.5 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          <ActorBadge actor={request.by} interactive={false} className="text-foreground" />
          <span>asked</span>
        </div>
      </div>
      <Button asChild size="sm">
        <Link href={ticketHref(ticket.key)}>Review</Link>
      </Button>
    </div>
  )
}

function PendingRow({ ticket }: { ticket: Ticket }) {
  return (
    <div className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-muted/60">
      <div className="min-w-0 flex-1">
        <Link
          href={ticketHref(ticket.key)}
          className="font-medium text-foreground hover:underline"
        >
          Review {ticket.key}
          <span className="text-muted-foreground"> · {ticket.title}</span>
        </Link>
        <div className="mt-1.5">
          <ActorBadge actor={ticket.created_by} interactive={false} />
        </div>
      </div>
      <Button asChild size="sm" variant="outline">
        <Link href={ticketHref(ticket.key)}>Open</Link>
      </Button>
    </div>
  )
}
