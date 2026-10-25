"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AnimatePresence, LayoutGroup, motion } from "motion/react"
import {
  CheckIcon,
  ChevronsUpDownIcon,
  LayoutGridIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "@/components/icons"

import { ACTOR_TYPES } from "@/shared/names"
import type { Category } from "@/lib/types"
import { CATEGORY_COLORS } from "@/lib/categories"
import { cn } from "@/lib/utils"
import { LiveActivity } from "@/components/board/live-activity"
import { NewTicketDialog } from "@/components/board/new-ticket-dialog"
import { TicketCard } from "@/components/board/ticket-card"
import { TicketModalFromUrl, ticketHref } from "@/components/board/ticket-modal"
import { SearchCombobox } from "@/components/search-combobox"
import {
  CategoryDialog,
  ColorDot,
  DeleteCategoryDialog,
} from "@/components/board/category-dialogs"
import { projectKeyOf, useProjects } from "@/components/projects/projects-store"
import { AgentTag, HumanAvatar } from "@/components/actor-badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
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
const TICKET_DRAG_TYPE = "application/x-nutshell-ticket"

const newestFirst = <T extends { created_at: Date }>(a: T, b: T) =>
  b.created_at.getTime() - a.created_at.getTime()

// Shared timing so motion animations feel like the tw-animate-css ones
const SPRING = { type: "spring", stiffness: 400, damping: 32 } as const

export function BoardView({ projectKey }: { projectKey: string }) {
  const store = useProjects()
  const router = useRouter()
  const project = store.projects.find((p) => p.key === projectKey)
  const categories = store.categoriesOf(projectKey)
  const tickets = store.tickets.filter(
    (t) => projectKeyOf(t.key) === projectKey
  )
  const activity = store.activity.filter(
    (e) => projectKeyOf(e.ticket_key) === projectKey
  )

  const [filter, setFilter] = useState<Filter>("all")
  const [editing, setEditing] = useState<Editing | null>(null)
  // Column a card is being dragged over, and the card being dragged
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)

  if (!project) {
    return (
      <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold">No project “{projectKey}”</h1>
        <p className="text-muted-foreground">
          It may have been made in another browser tab. Projects are sample data
          until we connect the database.
        </p>
        <Button asChild>
          <Link href="/projects">See all projects</Link>
        </Button>
      </main>
    )
  }

  // Every tag used on this board, offered as suggestions when tagging
  const tagSuggestions = store.tagsOf(projectKey)

  const visible = tickets.filter(
    (t) =>
      filter === "all" ||
      (filter === "humans" && t.created_by.type === ACTOR_TYPES.HUMAN) ||
      (filter === "agents" && t.created_by.type === ACTOR_TYPES.AGENT)
  )

  return (
    <main className="mx-auto grid max-w-screen-2xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-5">
        {/* Title row */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Breadcrumb>
              <BreadcrumbList className="font-mono text-xs tracking-widest uppercase">
                <BreadcrumbItem>
                  <BreadcrumbLink href="/teams">{project.team}</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator>·</BreadcrumbSeparator>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/projects">Projects</BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            {/* Project switcher: the title opens a search over the team's projects */}
            <SearchCombobox
              label="Switch project"
              searchPlaceholder="Find a project"
              emptyText="No project found."
              trigger={
                <button
                  type="button"
                  className="-ml-1 flex items-center gap-2 rounded-lg px-1 text-left text-3xl font-semibold tracking-tight hover:bg-muted"
                >
                  {project.name}
                  <ChevronsUpDownIcon
                    className="size-5 text-muted-foreground"
                    aria-hidden="true"
                  />
                </button>
              }
              groups={[
                {
                  heading: project.team,
                  items: store.projects
                    .filter((p) => p.team === project.team)
                    .map((p) => ({
                      value: p.key,
                      keywords: [p.name],
                      label: (
                        <>
                          <span className="shrink-0 font-mono text-xs text-muted-foreground">
                            {p.key}
                          </span>
                          <span className="flex-1 truncate">{p.name}</span>
                          {p.key === project.key && <CheckIcon aria-hidden="true" />}
                        </>
                      ),
                      onSelect: () => router.push(`/projects/${p.key}/board`),
                    })),
                },
                {
                  items: [
                    {
                      value: "all-projects",
                      keywords: ["projects", "all"],
                      label: (
                        <>
                          <LayoutGridIcon aria-hidden="true" /> All projects
                        </>
                      ),
                      onSelect: () => router.push("/projects"),
                    },
                  ],
                },
              ]}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Find a ticket by id, title or tag; grouped by column */}
            <SearchCombobox
              label="Search tickets…"
              searchPlaceholder="Ticket id, title or tag"
              emptyText="No ticket found."
              className="w-56"
              groups={categories.map((c) => ({
                heading: c.name,
                items: tickets
                  .filter((t) => t.status === c.slug)
                  .sort(newestFirst)
                  .map((t) => ({
                    value: t.key,
                    keywords: [t.title, ...(t.tags ?? [])],
                    label: (
                      <>
                        <span className="shrink-0 font-mono text-xs text-muted-foreground">
                          {t.key}
                        </span>
                        <span className="truncate">{t.title}</span>
                      </>
                    ),
                    onSelect: () =>
                      router.push(ticketHref(t.key), { scroll: false }),
                  })),
              }))}
            />
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
              <PlusIcon data-icon="inline-start" aria-hidden="true" />
              New category
            </Button>
            <NewTicketDialog
              categories={categories}
              tagSuggestions={tagSuggestions}
              onCreate={(input) => store.createTicket(projectKey, input)}
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
          <LayoutGroup id={projectKey}>
            <div className="flex gap-4">
              <AnimatePresence initial={false} mode="popLayout">
                {categories.map((category, index) => {
                  const columnTickets = visible
                    .filter((t) => t.status === category.slug)
                    .sort(newestFirst)
                  const total = tickets.filter(
                    (t) => t.status === category.slug
                  ).length
                  const isTarget = dropTarget === category.slug
                  return (
                    // Columns fade up one after another on load, and slide in/out
                    // when added or deleted
                    <motion.div
                      key={category.slug}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        scale: isTarget ? 1.015 : 1,
                      }}
                      exit={{
                        opacity: 0,
                        scale: 0.9,
                        transition: { duration: 0.15 },
                      }}
                      transition={{
                        ...SPRING,
                        delay: dragging ? 0 : index * 0.04,
                      }}
                      className="w-72 shrink-0"
                    >
                      <section
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
                          if (
                            !e.currentTarget.contains(e.relatedTarget as Node)
                          )
                            setDropTarget(null)
                        }}
                        onDrop={(e) => {
                          const key = e.dataTransfer.getData(TICKET_DRAG_TYPE)
                          setDropTarget(null)
                          if (key) store.moveTicket(key, category.slug)
                        }}
                        className={cn(
                          "flex min-h-96 flex-col gap-3 rounded-xl p-3 transition-shadow duration-150",
                          CATEGORY_COLORS[category.color].column,
                          isTarget && "shadow-lg ring-2 ring-foreground/40"
                        )}
                      >
                        <h2 className="flex items-center gap-2 px-1 text-sm font-semibold">
                          <ColorDot color={category.color} />
                          <span className="min-w-0 flex-1 truncate">
                            {category.name}
                          </span>
                          {/* The count rolls to its new value */}
                          <AnimatePresence mode="popLayout" initial={false}>
                            <motion.span
                              key={columnTickets.length}
                              initial={{ y: -8, opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                              exit={{ y: 8, opacity: 0 }}
                              transition={{ duration: 0.15 }}
                              className="text-muted-foreground tabular-nums"
                            >
                              {columnTickets.length}
                            </motion.span>
                          </AnimatePresence>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                aria-label={`Options for ${category.name}`}
                              >
                                <MoreHorizontalIcon aria-hidden="true" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onSelect={() =>
                                  setEditing({ kind: "edit", category })
                                }
                              >
                                <PencilIcon aria-hidden="true" /> Rename or recolor
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                disabled={categories.length === 1}
                                onSelect={() =>
                                  setEditing({ kind: "delete", category })
                                }
                              >
                                <Trash2Icon aria-hidden="true" /> Delete category
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </h2>
                        {columnTickets.map((ticket) => {
                          const isNew = store.newTicketKeys.has(ticket.key)
                          return (
                            // layoutId lets the card glide to its new column when it moves.
                            // New tickets pop in; existing ones only animate their position.
                            <motion.div
                              key={ticket.key}
                              layoutId={ticket.key}
                              layout="position"
                              initial={
                                isNew
                                  ? { opacity: 0, scale: 0.85, y: -8 }
                                  : false
                              }
                              animate={{
                                opacity: dragging === ticket.key ? 0.4 : 1,
                                scale: dragging === ticket.key ? 0.97 : 1,
                                y: 0,
                              }}
                              transition={SPRING}
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
                                  setDragging(ticket.key)
                                }}
                                onDragEnd={() => {
                                  setDropTarget(null)
                                  setDragging(null)
                                }}
                                className="cursor-grab active:cursor-grabbing"
                              >
                                <TicketCard ticket={ticket} />
                              </div>
                            </motion.div>
                          )
                        })}
                        {total === 0 && (
                          <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground"
                          >
                            Drag tickets here
                          </motion.p>
                        )}
                      </section>
                    </motion.div>
                  )
                })}
                <motion.button
                  key="add-category"
                  layout
                  type="button"
                  onClick={() => setEditing({ kind: "create" })}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={SPRING}
                  className="flex min-h-96 w-56 shrink-0 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                >
                  <PlusIcon className="size-5" aria-hidden="true" />
                  Add category
                </motion.button>
              </AnimatePresence>
            </div>
          </LayoutGroup>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      <aside className="min-w-0">
        <LiveActivity
          events={activity}
          newIds={store.newEventIds}
          categories={categories}
        />
      </aside>

      <TicketModalFromUrl
        projectKey={projectKey}
        tickets={tickets}
        categories={categories}
        tagSuggestions={tagSuggestions}
        comments={store.comments}
        events={activity}
        newCommentIds={store.newCommentIds}
        onComment={store.comment}
        onApprove={store.approve}
        onRequestChanges={store.requestChanges}
        onMove={store.moveTicket}
        onTagsChange={store.setTags}
      />

      {editing?.kind === "create" && (
        <CategoryDialog
          onSave={(input) => store.createCategory(projectKey, input)}
          onClose={() => setEditing(null)}
        />
      )}
      {editing?.kind === "edit" && (
        <CategoryDialog
          category={editing.category}
          onSave={(changes) =>
            store.updateCategory(projectKey, editing.category.slug, changes)
          }
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
          onDelete={(moveTo) =>
            store.deleteCategory(projectKey, editing.category.slug, moveTo)
          }
          onClose={() => setEditing(null)}
        />
      )}
    </main>
  )
}
