"use client"

import { useRef, useState } from "react"
import {
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { LayoutGroup, MotionConfig, motion } from "motion/react"
import { toast } from "sonner"

import { ACTOR_TYPES, EVENT_ACTIONS, TICKET_STATUS } from "@/shared/names"
import type { Actor, Category, Comment, Event, Ticket } from "@/lib/types"
import {
  CURRENT_USER_ID,
  MOCK_NOW,
  comments as allComments,
  events as allEvents,
  tickets as allTickets,
} from "@/lib/mock-data"
import {
  CATEGORY_COLORS,
  DEFAULT_CATEGORIES,
  categoryName,
  makeSlug,
  type CategoryColor,
} from "@/lib/categories"
import { eventId } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  CategoryDialog,
  ColorDot,
  DeleteCategoryDialog,
} from "@/components/board/category-dialogs"
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
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

type Filter = "all" | "humans" | "agents"

// Which category dialog is open, if any
type Editing =
  | { kind: "create" }
  | { kind: "edit"; category: Category }
  | { kind: "delete"; category: Category }

// The drag payload type, so columns ignore anything else dropped on them
const TICKET_DRAG_TYPE = "application/x-buck2agents-ticket"

const newestFirst = <T extends { created_at: Date }>(a: T, b: T) =>
  b.created_at.getTime() - a.created_at.getTime()

export function BoardView() {
  const [tickets, setTickets] = useState<Ticket[]>(allTickets)
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES)
  const [editing, setEditing] = useState<Editing | null>(null)
  // Column a card is being dragged over, for the drop highlight
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [activity, setActivity] = useState<Event[]>(() =>
    [...allEvents].sort(newestFirst)
  )
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

  function setStatus(
    ticketKey: string,
    status: string,
    changes: Partial<Ticket> = {}
  ) {
    setTickets((current) =>
      current.map((t) =>
        t.key === ticketKey ? { ...t, ...changes, status } : t
      )
    )
  }

  function addEvent(event: Event) {
    setActivity((current) => [event, ...current])
    setNewEventIds((ids) => new Set(ids).add(eventId(event)))
  }

  function createTicket({
    title,
    status,
    tags,
  }: {
    title: string
    status: string
    tags: string[]
  }) {
    const nextNumber =
      Math.max(...tickets.map((t) => Number(t.key.split("-")[1]))) + 1
    const key = `CLW-${String(nextNumber).padStart(2, "0")}`
    const created_by = me
    const created_at = now()
    const ticket: Ticket = {
      key,
      title,
      ...(tags.length > 0 && { tags }),
      status,
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
      details: { status },
      created_at,
    })
    toast.success(`Created ${key}`, { description: title })
  }

  // Move a ticket to another column (drag and drop, or the panel's picker)
  function moveTicket(ticketKey: string, to: string) {
    const ticket = tickets.find((t) => t.key === ticketKey)
    if (!ticket || ticket.status === to) return
    setStatus(ticketKey, to)
    addEvent({
      action: EVENT_ACTIONS.TICKET_MOVED,
      ticket_key: ticketKey,
      actor: me,
      details: { from: ticket.status, to },
      created_at: now(),
    })
    toast(`Moved ${ticketKey}`, {
      description: `To ${categoryName(to, categories)}`,
    })
  }

  function setTags(ticketKey: string, tags: string[]) {
    setTickets((current) =>
      current.map((t) => (t.key === ticketKey ? { ...t, tags } : t))
    )
  }

  function createCategory({
    name,
    color,
  }: {
    name: string
    color: CategoryColor
  }) {
    const slug = makeSlug(
      name,
      categories.map((c) => c.slug)
    )
    setCategories((current) => [
      ...current,
      { slug, name, color, order: current.length },
    ])
    toast.success(`Added category ${name}`)
  }

  function updateCategory(
    slug: string,
    changes: { name: string; color: CategoryColor }
  ) {
    setCategories((current) =>
      current.map((c) => (c.slug === slug ? { ...c, ...changes } : c))
    )
  }

  function deleteCategory(slug: string, moveTo: string) {
    setTickets((current) =>
      current.map((t) => (t.status === slug ? { ...t, status: moveTo } : t))
    )
    setCategories((current) =>
      current
        .filter((c) => c.slug !== slug)
        .map((c, order) => ({ ...c, order }))
    )
    toast(`Deleted category ${categoryName(slug, categories)}`)
  }

  function comment(ticketKey: string, body: string) {
    const created_at = now()
    addComment({ ticket_key: ticketKey, author: me, body, created_at })
    addEvent({
      action: EVENT_ACTIONS.COMMENT_ADDED,
      ticket_key: ticketKey,
      actor: me,
      created_at,
    })
  }

  // A shared status word if that column still exists, otherwise the ticket's current column
  const columnOr = (slug: string, ticketKey: string) =>
    categories.some((c) => c.slug === slug)
      ? slug
      : (tickets.find((t) => t.key === ticketKey)?.status ?? slug)

  function approve(ticketKey: string) {
    const to = columnOr(TICKET_STATUS.DONE, ticketKey)
    setStatus(ticketKey, to, { needs_approval: false })
    addEvent({
      action: EVENT_ACTIONS.TICKET_CLOSED,
      ticket_key: ticketKey,
      actor: me,
      details: { from: TICKET_STATUS.IN_REVIEW, to },
      created_at: now(),
    })
    toast.success(`Approved ${ticketKey}`, {
      description: `Moved to ${categoryName(to, categories)}`,
    })
  }

  function requestChanges(ticketKey: string) {
    const to = columnOr(TICKET_STATUS.IN_PROGRESS, ticketKey)
    setStatus(ticketKey, to)
    addEvent({
      action: EVENT_ACTIONS.TICKET_MOVED,
      ticket_key: ticketKey,
      actor: me,
      details: { from: TICKET_STATUS.IN_REVIEW, to },
      created_at: now(),
    })
    toast(`Changes requested on ${ticketKey}`, {
      description: `Moved to ${categoryName(to, categories)}`,
    })
  }

  // Every tag used on the board, offered as suggestions when tagging
  const tagSuggestions = [
    ...new Set(tickets.flatMap((t) => t.tags ?? [])),
  ].sort()

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
                    <BreadcrumbPage className="text-muted-foreground">
                      Project
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <h1 className="text-3xl font-semibold tracking-tight">
                HackOHI/O build
              </h1>
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
              <Button
                variant="outline"
                onClick={() => setEditing({ kind: "create" })}
              >
                <PlusIcon data-icon="inline-start" />
                New category
              </Button>
              <NewTicketDialog
                categories={categories}
                tagSuggestions={tagSuggestions}
                onCreate={createTicket}
              />
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

          {/* Columns. One LayoutGroup lets a card animate from one column to another.
              Drag a card onto another column to move it. */}
          <ScrollArea className="w-full pb-3">
            <LayoutGroup>
              <div className="flex gap-4">
                {categories.map((category) => {
                  const columnTickets = visible
                    .filter((t) => t.status === category.slug)
                    .sort(newestFirst)
                  const total = tickets.filter(
                    (t) => t.status === category.slug
                  ).length
                  return (
                    <section
                      key={category.slug}
                      aria-label={category.name}
                      onDragOver={(e) => {
                        if (!e.dataTransfer.types.includes(TICKET_DRAG_TYPE))
                          return
                        e.preventDefault()
                        e.dataTransfer.dropEffect = "move"
                        setDropTarget(category.slug)
                      }}
                      onDragLeave={(e) => {
                        // Ignore leaving into a child element of this column
                        if (!e.currentTarget.contains(e.relatedTarget as Node))
                          setDropTarget(null)
                      }}
                      onDrop={(e) => {
                        const key = e.dataTransfer.getData(TICKET_DRAG_TYPE)
                        setDropTarget(null)
                        if (key) moveTicket(key, category.slug)
                      }}
                      className={cn(
                        "flex min-h-96 w-72 shrink-0 flex-col gap-3 rounded-xl p-3 transition-shadow duration-150",
                        CATEGORY_COLORS[category.color].column,
                        dropTarget === category.slug &&
                          "ring-2 ring-foreground/40"
                      )}
                    >
                      <h2 className="flex items-center gap-2 px-1 text-sm font-semibold">
                        <ColorDot color={category.color} />
                        <span className="min-w-0 flex-1 truncate">
                          {category.name}
                        </span>
                        <span className="text-muted-foreground tabular-nums">
                          {columnTickets.length}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-label={`Options for ${category.name}`}
                            >
                              <MoreHorizontalIcon />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() =>
                                setEditing({ kind: "edit", category })
                              }
                            >
                              <PencilIcon /> Rename or recolor
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              disabled={categories.length === 1}
                              onSelect={() =>
                                setEditing({ kind: "delete", category })
                              }
                            >
                              <Trash2Icon /> Delete category
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </h2>
                      {columnTickets.map((ticket) => (
                        <motion.div
                          key={ticket.key}
                          layoutId={ticket.key}
                          layout="position"
                          transition={{ duration: 0.3, ease: "easeInOut" }}
                        >
                          {/* Plain div for native drag and drop; motion uses its own drag props */}
                          <div
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData(
                                TICKET_DRAG_TYPE,
                                ticket.key
                              )
                              e.dataTransfer.effectAllowed = "move"
                            }}
                            onDragEnd={() => setDropTarget(null)}
                            className="cursor-grab active:cursor-grabbing"
                          >
                            <TicketCard
                              ticket={ticket}
                              isNew={newTicketKeys.has(ticket.key)}
                            />
                          </div>
                        </motion.div>
                      ))}
                      {total === 0 && (
                        <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                          Drag tickets here
                        </p>
                      )}
                    </section>
                  )
                })}
                <button
                  type="button"
                  onClick={() => setEditing({ kind: "create" })}
                  className="flex min-h-96 w-56 shrink-0 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                >
                  <PlusIcon className="size-5" />
                  Add category
                </button>
              </div>
            </LayoutGroup>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>

        <aside className="min-w-0">
          <LiveActivity
            events={activity}
            newIds={newEventIds}
            categories={categories}
          />
        </aside>

        <TicketSheetFromUrl
          tickets={tickets}
          categories={categories}
          tagSuggestions={tagSuggestions}
          comments={comments}
          newCommentIds={newCommentIds}
          onComment={comment}
          onApprove={approve}
          onRequestChanges={requestChanges}
          onMove={moveTicket}
          onTagsChange={setTags}
        />

        {editing?.kind === "create" && (
          <CategoryDialog
            onSave={createCategory}
            onClose={() => setEditing(null)}
          />
        )}
        {editing?.kind === "edit" && (
          <CategoryDialog
            category={editing.category}
            onSave={(changes) => updateCategory(editing.category.slug, changes)}
            onClose={() => setEditing(null)}
          />
        )}
        {editing?.kind === "delete" && (
          <DeleteCategoryDialog
            category={editing.category}
            others={categories.filter((c) => c.slug !== editing.category.slug)}
            ticketCount={
              tickets.filter((t) => t.status === editing.category.slug).length
            }
            onDelete={(moveTo) => deleteCategory(editing.category.slug, moveTo)}
            onClose={() => setEditing(null)}
          />
        )}
      </main>
    </MotionConfig>
  )
}
