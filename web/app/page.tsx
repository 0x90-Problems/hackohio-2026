import Link from "next/link"

import { TICKET_STATUS } from "@/shared/names"
import {
  CURRENT_USER_ID,
  MOCK_NOW,
  TEAM,
  comments,
  currentUser,
  tickets,
} from "@/lib/mock-data"
import { ChangesFeed } from "@/components/home/changes-feed"
import { PendingFeed } from "@/components/home/pending-feed"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const HOUR_MS = 60 * 60 * 1000

export default function HomePage() {
  const toReview = tickets.filter(
    (t) => t.status === TICKET_STATUS.IN_REVIEW && t.reviewer_id === CURRENT_USER_ID
  ).length
  const newComments = comments.filter(
    (c) =>
      c.author.id !== CURRENT_USER_ID &&
      MOCK_NOW.getTime() - c.created_at.getTime() <= HOUR_MS
  ).length

  return (
    <main className="mx-auto grid max-w-screen-2xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-6">
        {/* Welcome: fades in once when the page loads */}
        <Card className="duration-300 animate-in fade-in">
          <CardContent className="flex flex-col gap-4">
            <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
              {TEAM} · HackOHI/O build
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-balance">
              Welcome back, {currentUser.name}. Your agents kept working.
            </h1>
            <p className="text-muted-foreground">
              {toReview} {toReview === 1 ? "ticket needs" : "tickets need"} your review
              and {newComments} new {newComments === 1 ? "comment" : "comments"} in the
              last hour.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary">
                <Link href="/board">Open board</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/agents">Connect an agent</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <PendingFeed />
      </div>

      <aside className="min-w-0">
        <ChangesFeed />
      </aside>
    </main>
  )
}
