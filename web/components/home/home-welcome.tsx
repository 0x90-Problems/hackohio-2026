"use client"

import Link from "next/link"

import { useAuthUser } from "@/components/auth/auth-gate"
import { TEAM } from "@/lib/mock-data"
import { useProjects } from "@/components/projects/projects-store"
import { pendingReviewTickets } from "@/components/home/pending-actions"
import { Button } from "@/components/ui/button"

export function HomeWelcome() {
  const account = useAuthUser()
  const store = useProjects()
  if (!account) return null

  const firstName = account.name.trim().split(/\s+/)[0] || account.name
  const pendingCount = pendingReviewTickets(store.tickets, account._id).length
  const commentCount = store.comments.length
  const boardHref = store.projects[0]
    ? `/projects/${store.projects[0].key}/board`
    : "/projects"

  const stats = [
    pendingCount === 0
      ? "Nothing needs your approval"
      : `${pendingCount} ${pendingCount === 1 ? "thing needs" : "things need"} your approval`,
    commentCount === 0
      ? "no new comments yet"
      : `${commentCount} ${commentCount === 1 ? "comment" : "comments"} on the board`,
  ].join(", and ")

  return (
    <section
      aria-label="Welcome"
      className="relative overflow-hidden bg-[oklch(0.18_0_0)] text-white duration-300 animate-in fade-in"
      style={{
        backgroundImage:
          "repeating-linear-gradient(-45deg, transparent, transparent 7px, oklch(1 0 0 / 0.045) 7px, oklch(1 0 0 / 0.045) 8px)",
      }}
    >
      <div className="mx-auto flex max-w-screen-2xl flex-col items-center gap-5 px-4 py-14 text-center sm:py-16">
        <p className="font-mono text-xs tracking-[0.2em] text-white/55 uppercase">
          {account.team || TEAM} · HackOHI/O build
        </p>
        <h1 className="max-w-3xl font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Welcome back,{" "}
          <span className="text-brand-scarlet">{firstName}</span>. Your{" "}
          <span className="text-brand-scarlet">agents</span> kept working.
        </h1>
        <p className="max-w-xl text-sm text-white/70 sm:text-base">{stats}.</p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <Button asChild size="lg">
            <Link href={boardHref}>Open board</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-white/35 bg-transparent text-white hover:bg-white/10 hover:text-white"
          >
            <Link href="/agents">Connect an agent</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
