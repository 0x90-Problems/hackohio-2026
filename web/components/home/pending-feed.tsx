"use client"

import Link from "next/link"

import type { Comment } from "@/lib/types"
import { useProjects } from "@/components/projects/projects-store"
import { timeAgo } from "@/lib/format"
import { ActorBadge } from "@/components/actor-badge"
import { commentId, ticketHref } from "@/components/board/ticket-modal"
import { FeedList, type FeedItem } from "@/components/feed-list"
import { LiveDot } from "@/components/live-dot"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type Row = FeedItem & { comment: Comment }

const RECENT_COMMENT_CAP = 20

export function PendingFeed() {
  const store = useProjects()
  const rows: Row[] = [...store.comments]
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    .slice(0, RECENT_COMMENT_CAP)
    .map((comment) => ({
      id: commentId(comment),
      kind: "comment" as const,
      comment,
      isNew: store.newCommentIds.has(commentId(comment)),
    }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent comments</CardTitle>
        <CardAction>
          <LiveDot label="Streaming" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <FeedList
          items={rows}
          pageSize={4}
          loading={false}
          emptyTitle="No comments yet"
          emptyHint="People and agents leave notes on tickets here."
          renderItem={(row) => <CommentRow comment={row.comment} />}
        />
      </CardContent>
    </Card>
  )
}

function CommentRow({ comment }: { comment: Comment }) {
  return (
    <Link
      href={ticketHref(comment.ticket_key)}
      className="-mx-2 flex flex-col gap-1.5 rounded-lg px-2 py-3 transition-colors hover:bg-muted/60"
    >
      <div className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
        <ActorBadge actor={comment.author} className="text-foreground" interactive={false} />
        <span className="shrink-0">
          on {comment.ticket_key} · {timeAgo(comment.created_at)}
        </span>
      </div>
      <p className="line-clamp-2 text-sm break-words">{comment.body}</p>
    </Link>
  )
}
