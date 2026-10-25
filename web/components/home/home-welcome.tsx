"use client"

import Link from "next/link"

import { TICKET_STATUS } from "@/shared/names"
import { useAuthUser } from "@/components/auth/auth-gate"
import { TEAM } from "@/lib/mock-data"
import { useProjects } from "@/components/projects/projects-store"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const HOUR_MS = 60 * 60 * 1000

export function HomeWelcome() {
  const account = useAuthUser()
  const store = useProjects()
  if (!account) return null

  const now = Date.now()
  const toReview = store.tickets.filter(
    (ticket) => ticket.status === TICKET_STATUS.IN_REVIEW && ticket.reviewer_id === account._id
  ).length
  const newComments = store.comments.filter(
    (comment) =>
      comment.author.id !== account._id &&
      now - comment.created_at.getTime() <= HOUR_MS
  ).length

  return (
    <Card className="duration-300 animate-in fade-in">
      <CardContent className="flex flex-col gap-4">
        <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
          {account.team || TEAM} · HackOHI/O build
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          Welcome back, {account.name}.
        </h1>
        <p className="text-muted-foreground">
          {toReview === 0 && newComments === 0
            ? "Nothing is waiting on you yet."
            : `${toReview} ${toReview === 1 ? "ticket needs" : "tickets need"} your review and ${newComments} new ${newComments === 1 ? "comment" : "comments"} in the last hour.`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href="/projects">Open projects</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/agents">Connect an agent</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
