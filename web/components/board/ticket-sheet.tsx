"use client"

import { useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import {
  ACTOR_TYPES,
  AGENT_CONNECTION,
  STATUS_LABELS,
  TICKET_STATUS,
} from "@/shared/names"
import type { Comment, Ticket } from "@/lib/types"
import {
  MOCK_NOW,
  agentTokens,
  currentUser,
  getAgent,
  getUser,
} from "@/lib/mock-data"
import { timeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"
import { ActorBadge, AgentTag, HumanAvatar } from "@/components/actor-badge"
import { ScopeBadge } from "@/components/scope-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"

const CONNECTION_LABELS = {
  [AGENT_CONNECTION.MCP]: "MCP",
  [AGENT_CONNECTION.API_KEY]: "API key",
}

export type TicketActions = {
  onComment: (ticketKey: string, body: string) => void
  onApprove: (ticketKey: string) => void
  onRequestChanges: (ticketKey: string) => void
}

// Opens the sheet for the ticket named in the address (?ticket=CLW-05).
// Closing it removes ?ticket= again. Kept separate so only this part waits
// for the URL; the rest of the board can still be prerendered.
export function TicketSheetFromUrl({
  tickets,
  comments,
  newCommentIds,
  ...actions
}: {
  tickets: Ticket[]
  comments: Comment[]
  newCommentIds: Set<string>
} & TicketActions) {
  const router = useRouter()
  const pathname = usePathname()
  const key = useSearchParams().get("ticket")
  const ticket = tickets.find((t) => t.key === key)

  return (
    <Sheet
      open={!!ticket}
      onOpenChange={(open) => !open && router.replace(pathname, { scroll: false })}
    >
      <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        {ticket && (
          <TicketDetail
            ticket={ticket}
            comments={comments.filter((c) => c.ticket_key === ticket.key)}
            newCommentIds={newCommentIds}
            {...actions}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

export const commentId = (c: Comment) =>
  `${c.ticket_key}-${c.author.id}-${c.created_at.getTime()}-${c.body.length}`

function TicketDetail({
  ticket,
  comments,
  newCommentIds,
  onComment,
  onApprove,
  onRequestChanges,
}: {
  ticket: Ticket
  comments: Comment[]
  newCommentIds: Set<string>
} & TicketActions) {
  const [draft, setDraft] = useState("")
  const inReview = ticket.status === TICKET_STATUS.IN_REVIEW
  const creator = ticket.created_by
  const agent = creator.type === ACTOR_TYPES.AGENT ? getAgent(creator.id) : undefined
  const owner = creator.type === ACTOR_TYPES.AGENT ? getUser(creator.acting_for) : undefined
  const reviewer = ticket.reviewer_id ? getUser(ticket.reviewer_id) : undefined
  // Scopes come from the agent's current token: not revoked and not expired.
  const token = agent
    ? agentTokens.find(
        (t) => t.agent_id === agent._id && !t.revoked && t.expires_at > MOCK_NOW
      )
    : undefined
  const sorted = [...comments].sort(
    (a, b) => b.created_at.getTime() - a.created_at.getTime()
  )

  function postComment() {
    if (!draft.trim()) return
    onComment(ticket.key, draft.trim())
    setDraft("")
  }

  function requestChanges() {
    // Anything typed in the box goes along as the reason.
    if (draft.trim()) postComment()
    onRequestChanges(ticket.key)
  }

  return (
    <>
      <SheetHeader className="gap-2 border-b p-6">
        <SheetDescription className="font-mono text-xs">
          {ticket.key}
          {ticket.label && ` · ${ticket.label}`}
        </SheetDescription>
        <SheetTitle className="text-2xl font-semibold tracking-tight">
          {ticket.title}
        </SheetTitle>
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-foreground text-background">
            {STATUS_LABELS[ticket.status]}
          </Badge>
          {ticket.needs_approval && <Badge variant="outline">Needs human approval</Badge>}
        </div>
      </SheetHeader>

      {/* Who's involved */}
      <dl className="grid grid-cols-[8rem_1fr] items-center gap-x-4 gap-y-3 p-6 text-sm">
        <dt className="text-muted-foreground">Created by</dt>
        <dd>
          {agent ? (
            <span className="inline-flex items-center gap-1.5">
              <AgentTag /> {agent.name}
            </span>
          ) : (
            <ActorBadge actor={creator} />
          )}
        </dd>

        {owner && (
          <>
            <dt className="text-muted-foreground">Acting for</dt>
            <dd className="inline-flex items-center gap-1.5">
              <HumanAvatar name={owner.name} /> {owner.name}
            </dd>
          </>
        )}

        {agent && (
          <>
            <dt className="text-muted-foreground">Agent setup</dt>
            <dd>
              {agent.name} · via {CONNECTION_LABELS[agent.connection]}
            </dd>
            <dt className="text-muted-foreground">Token scopes</dt>
            <dd className="flex flex-wrap gap-1.5">
              {(token?.scopes ?? agent.scopes).map((scope) => (
                <ScopeBadge key={scope} scope={scope} />
              ))}
            </dd>
          </>
        )}

        <dt className="text-muted-foreground">Reviewer</dt>
        <dd>
          {reviewer ? (
            <span className="inline-flex items-center gap-1.5">
              <HumanAvatar name={reviewer.name} /> {reviewer.name}
            </span>
          ) : (
            <span className="text-muted-foreground">None</span>
          )}
        </dd>
      </dl>

      <Separator />

      {/* Linked commits */}
      <section className="flex flex-col gap-3 p-6">
        <h3 className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
          Linked commits
        </h3>
        {ticket.linked_commits?.length ? (
          <ul className="flex flex-col gap-2">
            {ticket.linked_commits.map((commit) => (
              <li
                key={commit.sha}
                className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm"
              >
                <code className="font-mono text-xs font-semibold">{commit.sha}</code>
                <span className="min-w-0 flex-1 truncate">{commit.message}</span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  +{commit.added} −{commit.removed}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No commits linked yet.</p>
        )}
      </section>

      <Separator />

      {/* Activity: agent comments in a dashed box, human comments in a solid box */}
      <section className="flex flex-col gap-3 p-6">
        <h3 className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
          Activity &amp; comments
        </h3>
        {sorted.length === 0 && (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        )}
        <ul className="flex flex-col gap-2">
          {sorted.map((comment) => {
            const id = commentId(comment)
            const byAgent = comment.author.type === ACTOR_TYPES.AGENT
            return (
              <li
                key={id}
                className={cn(
                  "flex flex-col gap-1.5 rounded-lg border p-3",
                  byAgent && "border-dashed border-muted-foreground/50 bg-muted/40",
                  newCommentIds.has(id) && "duration-300 animate-in fade-in slide-in-from-top-2"
                )}
              >
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <ActorBadge actor={comment.author} className="text-xs text-foreground" />
                  <span className="shrink-0">{timeAgo(comment.created_at)}</span>
                </div>
                <p className="text-sm">{comment.body}</p>
              </li>
            )
          })}
        </ul>

        <div className="mt-2 flex flex-col gap-2">
          <Label htmlFor="comment">Comment as {currentUser.name}</Label>
          <Textarea
            id="comment"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) postComment()
            }}
            placeholder="Write a comment. Agents on this ticket get notified."
          />
          <Button
            variant="outline"
            size="sm"
            className="self-end"
            disabled={!draft.trim()}
            onClick={postComment}
          >
            Comment
          </Button>
        </div>
      </section>

      <SheetFooter className="sticky bottom-0 grid grid-cols-2 gap-3 border-t bg-background p-6">
        <Button disabled={!inReview} onClick={() => onApprove(ticket.key)}>
          Approve
        </Button>
        <Button variant="outline" disabled={!inReview} onClick={requestChanges}>
          Request changes
        </Button>
        {!inReview && (
          <p className="col-span-2 text-center text-xs text-muted-foreground">
            Approve and Request changes work once the ticket is In review.
          </p>
        )}
      </SheetFooter>
    </>
  )
}
