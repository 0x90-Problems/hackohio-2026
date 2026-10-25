"use client"

import Link from "next/link"

import { TICKET_STATUS } from "@/shared/names"
import { categoryName } from "@/lib/categories"
import type { Comment, Ticket } from "@/lib/types"
import { useProjects } from "@/components/projects/projects-store"
import { useAuthUser } from "@/components/auth/auth-gate"
import { timeAgo } from "@/lib/format"
import { useMockLoading } from "@/lib/use-mock-loading"
import { ActorBadge } from "@/components/actor-badge"
import { ticketHref } from "@/components/board/ticket-modal"
import { FeedList, type FeedItem } from "@/components/feed-list"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type Row =
  | (FeedItem & { kind: "pending"; ticket: Ticket })
  | (FeedItem & { kind: "comment"; comment: Comment })

const commentId = (c: Comment) => `comment-${c.ticket_key}-${c.created_at.getTime()}`

export function PendingFeed() {
  const account = useAuthUser()
  const store = useProjects()
  const loading = useMockLoading()
  const pendingRows: Row[] = account
    ? store.tickets
        .filter((ticket) => ticket.status === TICKET_STATUS.IN_REVIEW && ticket.reviewer_id === account._id)
        .map((ticket) => ({ id: `pending-${ticket.key}`, kind: "pending", ticket }))
    : []
  const commentRows: Row[] = [...store.comments]
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    .map((comment) => ({ id: commentId(comment), kind: "comment" as const, comment }))
  const rows: Row[] = [...pendingRows, ...commentRows]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending actions &amp; recent comments</CardTitle>
      </CardHeader>
      <CardContent>
        <FeedList
          items={rows}
          pageSize={4}
          loading={loading}
          renderItem={(row) =>
            row.kind === "pending" ? (
              <PendingRow ticket={row.ticket} />
            ) : (
              <CommentRow comment={row.comment} />
            )
          }
        />
      </CardContent>
    </Card>
  )
}

function PendingRow({ ticket }: { ticket: Ticket }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Waiting on you</Badge>
          <span className="truncate text-sm font-medium">
            {ticket.key} · {ticket.title}
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
          <ActorBadge actor={ticket.created_by} />
          <span className="shrink-0">· {categoryName(ticket.status)}</span>
        </div>
      </div>
      <Button asChild variant="outline" size="sm">
        <Link href={ticketHref(ticket.key)}>Review</Link>
      </Button>
    </div>
  )
}

function CommentRow({ comment }: { comment: Comment }) {
  return (
    <Link
      href={ticketHref(comment.ticket_key)}
      className="-mx-2 flex flex-col gap-1.5 rounded-lg px-2 py-3 transition-colors hover:bg-muted/60"
    >
      <div className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
        <ActorBadge actor={comment.author} className="text-foreground" />
        <span className="shrink-0">
          on {comment.ticket_key} · {timeAgo(comment.created_at)}
        </span>
      </div>
      <p className="text-sm">{comment.body}</p>
    </Link>
  )
}
