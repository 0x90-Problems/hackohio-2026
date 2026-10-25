"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"

import { ACTOR_TYPES, AGENT_CONNECTION, EVENT_ACTIONS, TICKET_STATUS } from "@/shared/names"
import type { Category, Comment, Event, Ticket } from "@/lib/types"
import {
  CATEGORY_COLORS,
  CATEGORY_COLOR_NAMES,
  type CategoryColor,
} from "@/lib/categories"
import {
  MOCK_NOW,
  agentTokens,
  getAgent,
  getUser,
  users,
} from "@/lib/mock-data"
import { useAuthUser } from "@/components/auth/auth-gate"
import { visibleAgentName } from "@/lib/agent-label"
import { useBoardDirectory } from "@/lib/use-board-directory"
import { listBoardUsers } from "@/lib/connect-agent"
import { timeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"
import { ActorBadge, AgentTag, HumanAvatar } from "@/components/actor-badge"
import { ChangeHistory } from "@/components/board/change-history"
import { TagInput } from "@/components/board/tag-input"
import { ScopeBadge } from "@/components/scope-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { HistoryIcon } from "@/components/icons"
import { EmptyState } from "@/components/illustrations"

const CONNECTION_LABELS = {
  [AGENT_CONNECTION.MCP]: "MCP",
  [AGENT_CONNECTION.API_KEY]: "API key",
}

export type TicketActions = {
  onComment: (ticketKey: string, body: string) => void
  onApprove: (ticketKey: string) => void
  onRequestChanges: (ticketKey: string) => void
  onMove: (ticketKey: string, status: string) => void
  onTagsChange: (ticketKey: string, tags: string[]) => void
  onDescriptionChange: (ticketKey: string, description: string) => void
  onColorChange: (ticketKey: string, color?: CategoryColor) => void
  onDueDateChange: (ticketKey: string, dueDate: string) => void
  onReviewerChange: (ticketKey: string, reviewerId: string) => void
  onDelete: (ticketKey: string) => void
}

// Opens the sheet for the ticket named in the address
// (/projects/CLW/board/ticket/CLW-05). Closing it goes back to the board.
export function TicketModalFromUrl({
  projectKey,
  tickets,
  categories,
  tagSuggestions,
  comments,
  events,
  newCommentIds,
  ...actions
}: {
  projectKey: string
  tickets: Ticket[]
  categories: Category[]
  tagSuggestions: string[]
  comments: Comment[]
  events: Event[]
  newCommentIds: Set<string>
} & TicketActions) {
  const router = useRouter()
  const key = ticketKeyFromPath(usePathname())
  const ticket = tickets.find((t) => t.key === key)

  return (
    // A centered modal over the board. Closing it (x, Esc, clicking outside)
    // goes back to the board's address.
    <Dialog
      open={!!ticket}
      onOpenChange={(open) =>
        !open && router.push(`/projects/${projectKey}/board`, { scroll: false })
      }
    >
      <DialogContent className="max-h-[90svh] gap-0 overflow-y-auto p-0 sm:max-w-5xl">
        {ticket && (
          <TicketDetail
            ticket={ticket}
            categories={categories}
            tagSuggestions={tagSuggestions}
            comments={comments.filter((c) => c.ticket_key === ticket.key)}
            events={events.filter((e) => e.ticket_key === ticket.key)}
            newCommentIds={newCommentIds}
            {...actions}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

// CLW-05 -> /projects/CLW/board/ticket/CLW-05
export const ticketHref = (key: string) =>
  `/projects/${key.split("-")[0]}/board/ticket/${encodeURIComponent(key)}`

function ticketKeyFromPath(pathname: string) {
  const match = pathname.match(/\/board\/ticket\/([^/]+)$/)
  return match ? decodeURIComponent(match[1]) : null
}

export const commentId = (c: Comment) =>
  `${c.ticket_key}-${c.author.id}-${c.created_at.getTime()}-${c.body.length}`

function TicketDetail({
  ticket,
  categories,
  tagSuggestions,
  comments,
  events,
  newCommentIds,
  onComment,
  onApprove,
  onRequestChanges,
  onMove,
  onTagsChange,
  onDescriptionChange,
  onColorChange,
  onDueDateChange,
  onReviewerChange,
  onDelete,
}: {
  ticket: Ticket
  categories: Category[]
  tagSuggestions: string[]
  comments: Comment[]
  events: Event[]
  newCommentIds: Set<string>
} & TicketActions) {
  const [draft, setDraft] = useState("")
  const [people, setPeople] = useState<{ _id: string; name: string }[]>(() => users.map((user) => ({ _id: user._id, name: user.name })))
  useEffect(() => {
    let cancelled = false
    listBoardUsers()
      .then((loaded) => {
        if (cancelled || loaded.length === 0) return
        setPeople((current) => {
          const known = new Set(current.map((person) => person._id))
          return [...current, ...loaded.filter((person) => !known.has(person._id))]
        })
      })
      .catch(() => {
        // The sample directory still fills the reviewer list.
      })
    return () => {
      cancelled = true
    }
  }, [])
  const account = useAuthUser()
  // The signed-in person can always be picked, even before the directory loads
  const reviewerOptions =
    account && !people.some((person) => person._id === account._id)
      ? [...people, { _id: account._id, name: account.name }]
      : people
  const inReview = ticket.status === TICKET_STATUS.IN_REVIEW
  const creator = ticket.created_by
  // Demo agents are in mock-data; real ones come from the live directory
  const directory = useBoardDirectory()
  const agent =
    creator.type === ACTOR_TYPES.AGENT
      ? (getAgent(creator.id) ?? directory.agents.find((a) => a._id === creator.id))
      : undefined
  const named =
    creator.type === ACTOR_TYPES.AGENT
      ? visibleAgentName(creator.name, creator.id, agent?.name)
      : undefined
  const agentName = named && named !== "Agent" ? named : undefined
  const owner =
    creator.type === ACTOR_TYPES.AGENT ? getUser(creator.acting_for) : undefined
  const ownerName =
    creator.type === ACTOR_TYPES.AGENT
      ? (creator.acting_for === account?._id ? account.name : owner?.name)
      : undefined
  const creatorId = creator.type === ACTOR_TYPES.AGENT ? creator.acting_for : creator.id
  const ownTicket = account?._id === creatorId
  const canDelete = account?.admin === true || ownTicket
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
    <div className="grid min-w-0 md:grid-cols-[minmax(0,1fr)_20rem]">
      <DialogHeader className="gap-2 border-b p-6 pr-14 md:col-span-2">
        <DialogDescription className="font-mono text-xs">
          {ticket.key}
        </DialogDescription>
        <DialogTitle className="text-2xl font-semibold tracking-tight">
          {ticket.title}
        </DialogTitle>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Move to column"
            className="h-8 rounded-md border bg-background px-2 text-sm"
            value={ticket.status}
            onChange={(event) => {
              const status = event.target.value
              if (status !== ticket.status) onMove(ticket.key, status)
            }}
          >
            {categories
              .filter((c) => c.slug === ticket.status || c.slug !== TICKET_STATUS.DONE || !ticket.needs_approval)
              .map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
          </select>
          {ticket.needs_approval && (
            <Badge variant="outline">Needs human approval</Badge>
          )}
        </div>
      </DialogHeader>

      <div className="min-w-0">
        <section className="flex flex-col gap-2 px-6 pt-6">
          <Label htmlFor="ticket-description">Description</Label>
          <Textarea
            id="ticket-description"
            className="min-h-24 resize-y"
            value={ticket.description ?? ""}
            onChange={(e) => onDescriptionChange(ticket.key, e.target.value)}
            placeholder="Add a description…"
          />
        </section>

        {/* Who's involved */}
        <dl className="grid grid-cols-[6.5rem_1fr] items-center gap-x-4 gap-y-3 p-6 text-sm sm:grid-cols-[8rem_1fr]">
          <dt className="text-muted-foreground">Created by</dt>
          <dd>
            {agentName ? (
              <span className="inline-flex items-center gap-1.5">
                <AgentTag /> {agentName}
              </span>
            ) : (
              <ActorBadge actor={creator} />
            )}
          </dd>

          {creator.type === ACTOR_TYPES.AGENT && (
            <>
              <dt className="text-muted-foreground">Acting for</dt>
              <dd className="inline-flex items-center gap-1.5">
                {ownerName ? (
                  <>
                    <HumanAvatar name={ownerName} /> {ownerName}
                  </>
                ) : (
                  <span className="text-muted-foreground">Unknown owner</span>
                )}
              </dd>
            </>
          )}

          {agent && (
            <>
              <dt className="text-muted-foreground">Agent setup</dt>
              <dd>
                {visibleAgentName(agent.name, agent._id)} · via {CONNECTION_LABELS[agent.connection]}
              </dd>
              <dt className="text-muted-foreground">Token scopes</dt>
              <dd className="flex flex-wrap gap-1.5">
                {(token?.scopes ?? agent.scopes).map((scope) => (
                  <ScopeBadge key={scope} scope={scope} />
                ))}
              </dd>
            </>
          )}

          <dt className="self-start pt-2 text-muted-foreground">
            <Label htmlFor="ticket-tags" className="font-normal">
              Tags
            </Label>
          </dt>
          <dd>
            <TagInput
              id="ticket-tags"
              tags={ticket.tags ?? []}
              onChange={(tags) => onTagsChange(ticket.key, tags)}
              suggestions={tagSuggestions}
            />
          </dd>

          <dt className="text-muted-foreground">Card color</dt>
          <dd>
            <div
              className="flex flex-wrap items-center gap-2"
              aria-label="Card color"
            >
              <button
                type="button"
                aria-label="Default card color"
                aria-pressed={!ticket.card_color}
                title="Default"
                onClick={() => onColorChange(ticket.key, undefined)}
                className={cn(
                  "size-5 rounded-full border bg-card",
                  !ticket.card_color && "ring-2 ring-foreground ring-offset-2"
                )}
              />
              {CATEGORY_COLOR_NAMES.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`${CATEGORY_COLORS[color].label} card color`}
                  aria-pressed={ticket.card_color === color}
                  title={CATEGORY_COLORS[color].label}
                  onClick={() => onColorChange(ticket.key, color)}
                  className={cn(
                    "size-5 rounded-full ring-offset-2 ring-offset-background",
                    CATEGORY_COLORS[color].dot,
                    ticket.card_color === color && "ring-2 ring-foreground"
                  )}
                />
              ))}
            </div>
          </dd>

          <dt className="text-muted-foreground">Reviewer</dt>
          <dd>
            <select
              aria-label="Reviewer"
              className="h-8 max-w-full rounded-md border bg-background px-2 text-sm"
              value={ticket.reviewer_id ?? ""}
              onChange={(event) => onReviewerChange(ticket.key, event.target.value)}
            >
              <option value="">None</option>
              {reviewerOptions.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.name}
                </option>
              ))}
            </select>
          </dd>
          <dt className="text-muted-foreground">Due date</dt>
          <dd>
            <input
              aria-label="Due date"
              type="date"
              className="h-8 rounded-md border bg-background px-2 text-sm"
              value={ticket.due_date ?? ""}
              onChange={(event) => onDueDateChange(ticket.key, event.target.value)}
            />
          </dd>
        </dl>

        <Separator />

        {/* Change history: every version of the card, from the activity log */}
        <section className="flex flex-col gap-3 p-6">
          <h3 className="flex items-center gap-1.5 font-mono text-xs tracking-widest text-muted-foreground uppercase">
            <HistoryIcon className="size-3.5" aria-hidden /> Change history
          </h3>
          <ChangeHistory
            events={[
              ...events,
              ...comments
                .filter((comment) => !events.some((event) => event.action === EVENT_ACTIONS.COMMENT_ADDED && event.details?.body === comment.body))
                .map((comment) => ({
                  action: EVENT_ACTIONS.COMMENT_ADDED,
                  ticket_key: comment.ticket_key,
                  project_key: comment.ticket_key.split("-")[0] ?? "",
                  actor: comment.author,
                  details: { body: comment.body },
                  created_at: comment.created_at,
                })),
            ]}
            categories={categories}
          />
        </section>

        <Separator />

        {/* Activity: agent comments in a dashed box, human comments in a solid box */}
        <section className="flex flex-col gap-3 p-6">
          <h3 className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
            Activity &amp; comments
          </h3>
          {sorted.length === 0 && (
            <EmptyState
              title="No comments yet"
              hint="Start the conversation below."
              className="py-2"
            />
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
                    byAgent &&
                      "border-dashed border-muted-foreground/50 bg-muted/40",
                    newCommentIds.has(id) &&
                      "animate-in duration-300 fade-in slide-in-from-top-2"
                  )}
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <ActorBadge
                      actor={comment.author}
                      className="text-xs text-foreground"
                    />
                    <span className="shrink-0">
                      {timeAgo(comment.created_at)}
                    </span>
                  </div>
                  <p className="text-sm">{comment.body}</p>
                </li>
              )
            })}
          </ul>

          <div className="mt-2 flex flex-col gap-2">
            <Label htmlFor="comment">Comment as {account?.name ?? "you"}</Label>
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
      </div>

      <aside className="flex min-w-0 flex-col gap-3 border-t bg-muted/20 p-6 md:border-t-0 md:border-l">
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
                <code className="font-mono text-xs font-semibold">
                  {commit.sha}
                </code>
                <span className="min-w-0 flex-1 truncate">
                  {commit.message}
                </span>
                <span className="flex shrink-0 gap-2 font-mono text-xs">
                  <span className="text-green-600 dark:text-green-400">
                    +{commit.added}
                  </span>
                  <span className="text-red-600 dark:text-red-400">
                    -{commit.removed}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No commits linked yet.
          </p>
        )}
      </aside>

      <DialogFooter className="sticky bottom-0 grid grid-cols-2 gap-3 border-t bg-popover p-6 sm:grid-cols-2 md:col-span-2">
        {canDelete ? (
          <Button
            variant="destructive"
            className="col-span-2"
            onClick={() => {
              if (window.confirm(`Delete ${ticket.key}? This cannot be undone.`)) onDelete(ticket.key)
            }}
          >
            Delete
          </Button>
        ) : null}
        <Button disabled={!inReview || ownTicket} onClick={() => onApprove(ticket.key)}>
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
      </DialogFooter>
    </div>
  )
}
