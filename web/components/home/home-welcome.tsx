"use client"

import Link from "next/link"

import { useAuthUser } from "@/components/auth/auth-gate"
import { TEAM } from "@/lib/mock-data"
import { useMockLoading } from "@/lib/use-mock-loading"
import { useProjects } from "@/components/projects/projects-store"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export function HomeWelcome() {
  const account = useAuthUser()
  const store = useProjects()
  const loading = useMockLoading()
  if (!account) return null

  const commentCount = store.comments.length

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
          {loading
            ? "Loading the board."
            : commentCount === 0
              ? "No comments on the board yet."
              : `${commentCount} ${commentCount === 1 ? "comment is" : "comments are"} on the board.`}
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
