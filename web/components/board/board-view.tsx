"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { LayoutGroup, MotionConfig, motion } from "motion/react"
import { toast } from "sonner"

import {
  ACTOR_TYPES,
  BOARD_COLUMNS,
  EVENT_ACTIONS,
  STATUS_LABELS,
  TICKET_STATUS,
  type TicketStatus,
} from "@/shared/names"
import type { Actor, Comment, Event, Ticket } from "@/lib/types"
import {
  CURRENT_USER_ID,
  MOCK_NOW,
  comments as allComments,
  events as allEvents,
  incomingComments,
  incomingEvents,
  tickets as allTickets,
} from "@/lib/mock-data"
import { eventId } from "@/lib/format"
import { LiveActivity } from "@/components/board/live-activity"
import { NewTicketDialog } from "@/components/board/new-ticket-dialog"
import { TicketCard } from "@/components/board/ticket-card"
import { TicketSheetFromUrl, commentId } from "@/components/board/ticket-sheet"
import { AgentTag, HumanAvatar } from "@/components/actor-badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

type Filter = "all" | "humans" | "agents"

const newestFirst = <T extends { created_at: Date }>(a: T, b: T) =>
  b.created_at.getTime() - a.created_at.getTime()

export function BoardView() {
  const [tickets, setTickets] = useState<Ticket[]>(allTickets)
  const [activity, setActivity] = useState<Event[]>(() => [...allEvents].sort(newestFirst))
  const [comments, setComments] = useState<Comment[]>(allComments)
  const [filter, setFilter] = useState<Filter>("all")
  // Remember what arrived after the page loaded, so only those animate in.
  const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set())
  const [newTicketKeys, setNewTicketKeys] = useState<Set<string>>(new Set())
  const [newCommentIds, setNewCommentIds] = useState<Set<string>>(new Set())

  // Mock clock: each new action is one second after the last, so times stay
  // in order and list keys stay unique. Real data will use the server's time.
  const clock = useRef(MOCK_NOW.getTime())
  const now = () => new Date((clock.current += 1000))
  const me: Actor = { type: ACTOR_TYPES.HUMAN, id: CURRENT_USER_ID }

  function addComment(comment: Comment) {
    setComments((current) => [...current, comment])
    setNewCommentIds((ids) => new Set(ids).add(commentId(comment)))
  }

  function setStatus(ticketKey: string, status: TicketStatus, changes: Partial<Ticket> = {}) {
    setTickets((current) =>
      current.map((t) => (t.key === ticketKey ? { ...t, ...changes, status } : t))
    )
  }

  function addEvent(event: Event) {
    setActivity((current) => [event, ...current])
    setNewEventIds((ids) => new Set(ids).add(eventId(event)))
  }

  // Demo: live events stream in. A "ticket_moved" event moves the card to its
  // new column, and motion animates it there.
  useEffect(() => {
    const timers = incomingEvents.map((event, i) =>
      setTimeout(() => {
        addEvent(event)
        if (event.action === EVENT_ACTIONS.COMMENT_ADDED) {
          incomingComments
            .filter((c) => c.ticket_key === event.ticket_key)
            .forEach(addComment)
        }
        if (event.action === EVENT_ACTIONS.TICKET_MOVED && event.details?.to) {
          setStatus(event.ticket_key, event.details.to as TicketStatus)
        }
      }, 3000 + i * 3000)
    )
    return () => timers.forEach(clearTimeout)
  }, [])

  function createTicket({ title, label }: { title: string; label?: string }) {
    const nextNumber = Math.max(...tickets.map((t) => Number(t.key.split("-")[1]))) + 1
    const key = `CLW-${String(nextNumber).padStart(2, "0")}`
    const created_by = me
    const created_at = now()
    const ticket: Ticket = {
      key,
      title,
      ...(label && { label }),
      status: TICKET_STATUS.BACKLOG,
      created_by,
      needs_approval: false,
      created_at,
    }
    setTickets((current) => [ticket, ...current])
    setNewTicketKeys((keys) => new Set(keys).add(key))
    addEvent({
      action: EVENT_ACTIONS.TICKET_CREATED,
      ticket_key: key,
      actor: created_by,
      details: { status: TICKET_STATUS.BACKLOG },
      created_at,
    })
    toast.success(`Created ${key}`, { description: title })
  }

  function comment(ticketKey: string, body: string) {
    const created_at = now()
    addComment({ ticket_key: ticketKey, author: me, body, created_at })
    addEvent({ action: EVENT_ACTIONS.COMMENT_ADDED, ticket_key: ticketKey, actor: me, created_at })
  }

  function approve(ticketKey: string) {
    setStatus(ticketKey, TICKET_STATUS.DONE, { needs_approval: false })
    addEvent({
      action: EVENT_ACTIONS.TICKET_CLOSED,
      ticket_key: ticketKey,
      actor: me,
      details: { from: TICKET_STATUS.IN_REVIEW, to: TICKET_STATUS.DONE },
      created_at: now(),
    })
    toast.success(`Approved ${ticketKey}`, { description: "Moved to Done" })
  }

  function requestChanges(ticketKey: string) {
    setStatus(ticketKey, TICKET_STATUS.IN_PROGRESS)
    addEvent({
      action: EVENT_ACTIONS.TICKET_MOVED,
      ticket_key: ticketKey,
      actor: me,
      details: { from: TICKET_STATUS.IN_REVIEW, to: TICKET_STATUS.IN_PROGRESS },
      created_at: now(),
    })
    toast(`Changes requested on ${ticketKey}`, { description: "Moved back to In progress" })
  }

  const visible = tickets.filter(
    (t) =>
      filter === "all" ||
      (filter === "humans" && t.created_by.type === ACTOR_TYPES.HUMAN) ||
      (filter === "agents" && t.created_by.type === ACTOR_TYPES.AGENT)
  )

  return (
    // reducedMotion="user": motion skips animations when the OS asks for less motion
    <MotionConfig reducedMotion="user">
      <main className="mx-auto grid max-w-screen-2xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* Title row */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-1">
              <Breadcrumb>
                <BreadcrumbList className="font-mono text-xs tracking-widest uppercase">
                  <BreadcrumbItem>
                    <BreadcrumbLink href="/teams">0x90 Problems</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator>·</BreadcrumbSeparator>
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-muted-foreground">Project</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <h1 className="text-3xl font-semibold tracking-tight">HackOHI/O build</h1>
            </div>
            <div className="flex items-center gap-3">
              <ToggleGroup
                type="single"
                variant="outline"
                value={filter}
                onValueChange={(v) => v && setFilter(v as Filter)}
                aria-label="Show tickets made by"
              >
                <ToggleGroupItem value="all">All</ToggleGroupItem>
                <ToggleGroupItem value="humans">Humans</ToggleGroupItem>
                <ToggleGroupItem value="agents">Agents</ToggleGroupItem>
              </ToggleGroup>
              <NewTicketDialog onCreate={createTicket} />
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <HumanAvatar name="AB" /> Human: solid circle + initials
            </span>
            <span className="inline-flex items-center gap-1.5">
              <AgentTag /> Agent: dashed gray tag + who it acts for
            </span>
          </div>

          {/* Columns. One LayoutGroup lets a card animate from one column to another. */}
          <ScrollArea className="w-full pb-3">
            <LayoutGroup>
              <div className="grid min-w-[60rem] grid-cols-4 gap-4">
                {BOARD_COLUMNS.map((status) => {
                  const columnTickets = visible
                    .filter((t) => t.status === status)
                    .sort(newestFirst)
                  return (
                    <section
                      key={status}
                      className="flex min-h-96 flex-col gap-3 rounded-xl bg-muted/60 p-3"
                    >
                      <h2 className="flex items-center justify-between px-1 text-sm font-semibold">
                        {STATUS_LABELS[status]}
                        <span className="text-muted-foreground tabular-nums">
                          {columnTickets.length}
                        </span>
                      </h2>
                      {columnTickets.map((ticket) => (
                        <motion.div
                          key={ticket.key}
                          layoutId={ticket.key}
                          layout="position"
                          transition={{ duration: 0.3, ease: "easeInOut" }}
                        >
                          <TicketCard ticket={ticket} isNew={newTicketKeys.has(ticket.key)} />
                        </motion.div>
                      ))}
                    </section>
                  )
                })}
              </div>
            </LayoutGroup>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>

        <aside className="min-w-0">
          <LiveActivity events={activity} newIds={newEventIds} />
        </aside>

        <Suspense fallback={null}>
          <TicketSheetFromUrl
            tickets={tickets}
            comments={comments}
            newCommentIds={newCommentIds}
            onComment={comment}
            onApprove={approve}
            onRequestChanges={requestChanges}
          />
        </Suspense>
      </main>
    </MotionConfig>
  )
}
