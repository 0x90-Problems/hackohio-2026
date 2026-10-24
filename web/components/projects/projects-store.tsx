"use client"

import { createContext, useContext, useRef, useState } from "react"
import { MotionConfig } from "motion/react"
import { toast } from "sonner"

import { ACTOR_TYPES, EVENT_ACTIONS, TICKET_STATUS } from "@/shared/names"
import type {
  Actor,
  Category,
  Comment,
  Event,
  Project,
  Ticket,
} from "@/lib/types"
import {
  CURRENT_USER_ID,
  MOCK_NOW,
  comments as allComments,
  events as allEvents,
  projects as allProjects,
  tickets as allTickets,
} from "@/lib/mock-data"
import {
  DEFAULT_CATEGORIES,
  categoryName,
  makeSlug,
  type CategoryColor,
} from "@/lib/categories"
import { eventId } from "@/lib/format"
import { commentId } from "@/components/board/ticket-sheet"

// CLW-05 -> CLW
export const projectKeyOf = (ticketKey: string) => ticketKey.split("-")[0]

const newestFirst = <T extends { created_at: Date }>(a: T, b: T) =>
  b.created_at.getTime() - a.created_at.getTime()

// Holds every project's board in one place, so moves, categories and tags
// survive switching pages. Still mock data: a reload starts over.
function useProjectsState() {
  const [projects, setProjects] = useState<Project[]>(allProjects)
  const [tickets, setTickets] = useState<Ticket[]>(allTickets)
  // Each project has its own columns
  const [categories, setCategories] = useState<Record<string, Category[]>>(() =>
    Object.fromEntries(allProjects.map((p) => [p.key, DEFAULT_CATEGORIES]))
  )
  const [activity, setActivity] = useState<Event[]>(() =>
    [...allEvents].sort(newestFirst)
  )
  const [comments, setComments] = useState<Comment[]>(allComments)
  // Remember what arrived after the page loaded, so only those animate in.
  const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set())
  const [newTicketKeys, setNewTicketKeys] = useState<Set<string>>(new Set())
  const [newCommentIds, setNewCommentIds] = useState<Set<string>>(new Set())
  const [newProjectKeys, setNewProjectKeys] = useState<Set<string>>(new Set())

  // Mock clock: each new action is one second after the last, so times stay
  // in order and list keys stay unique. Real data will use the server's time.
  const clock = useRef(MOCK_NOW.getTime())
  const now = () => new Date((clock.current += 1000))
  const me: Actor = { type: ACTOR_TYPES.HUMAN, id: CURRENT_USER_ID }

  const categoriesOf = (projectKey: string) =>
    categories[projectKey] ?? DEFAULT_CATEGORIES
  const categoriesOfTicket = (ticketKey: string) =>
    categoriesOf(projectKeyOf(ticketKey))

  function setProjectCategories(
    projectKey: string,
    update: (current: Category[]) => Category[]
  ) {
    setCategories((all) => ({
      ...all,
      [projectKey]: update(all[projectKey] ?? DEFAULT_CATEGORIES),
    }))
  }

  function addComment(comment: Comment) {
    setComments((current) => [...current, comment])
    setNewCommentIds((ids) => new Set(ids).add(commentId(comment)))
  }

  function addEvent(event: Event) {
    setActivity((current) => [event, ...current])
    setNewEventIds((ids) => new Set(ids).add(eventId(event)))
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

  function createProject(input: {
    name: string
    key: string
    description?: string
    team: string
  }) {
    const project: Project = { ...input, created_at: now() }
    setProjects((current) => [...current, project])
    setCategories((all) => ({ ...all, [project.key]: DEFAULT_CATEGORIES }))
    setNewProjectKeys((keys) => new Set(keys).add(project.key))
    toast.success(`Created project ${project.name}`, {
      description: `Tickets will be ${project.key}-01, ${project.key}-02 …`,
    })
  }

  function createTicket(
    projectKey: string,
    input: { title: string; status: string; tags: string[] }
  ) {
    const numbers = tickets
      .filter((t) => projectKeyOf(t.key) === projectKey)
      .map((t) => Number(t.key.split("-")[1]))
    const key = `${projectKey}-${String(Math.max(0, ...numbers) + 1).padStart(2, "0")}`
    const created_at = now()
    const ticket: Ticket = {
      key,
      title: input.title,
      ...(input.tags.length > 0 && { tags: input.tags }),
      status: input.status,
      created_by: me,
      needs_approval: false,
      created_at,
    }
    setTickets((current) => [ticket, ...current])
    setNewTicketKeys((keys) => new Set(keys).add(key))
    addEvent({
      action: EVENT_ACTIONS.TICKET_CREATED,
      ticket_key: key,
      actor: me,
      details: { status: input.status },
      created_at,
    })
    toast.success(`Created ${key}`, { description: input.title })
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
      description: `To ${categoryName(to, categoriesOfTicket(ticketKey))}`,
    })
  }

  function setTags(ticketKey: string, tags: string[]) {
    setTickets((current) =>
      current.map((t) => (t.key === ticketKey ? { ...t, tags } : t))
    )
  }

  function createCategory(
    projectKey: string,
    { name, color }: { name: string; color: CategoryColor }
  ) {
    const slug = makeSlug(
      name,
      categoriesOf(projectKey).map((c) => c.slug)
    )
    setProjectCategories(projectKey, (current) => [
      ...current,
      { slug, name, color, order: current.length },
    ])
    toast.success(`Added category ${name}`)
  }

  function updateCategory(
    projectKey: string,
    slug: string,
    changes: { name: string; color: CategoryColor }
  ) {
    setProjectCategories(projectKey, (current) =>
      current.map((c) => (c.slug === slug ? { ...c, ...changes } : c))
    )
  }

  function deleteCategory(projectKey: string, slug: string, moveTo: string) {
    setTickets((current) =>
      current.map((t) =>
        projectKeyOf(t.key) === projectKey && t.status === slug
          ? { ...t, status: moveTo }
          : t
      )
    )
    setProjectCategories(projectKey, (current) =>
      current
        .filter((c) => c.slug !== slug)
        .map((c, order) => ({ ...c, order }))
    )
    toast(`Deleted category ${categoryName(slug, categoriesOf(projectKey))}`)
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
    categoriesOfTicket(ticketKey).some((c) => c.slug === slug)
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
      description: `Moved to ${categoryName(to, categoriesOfTicket(ticketKey))}`,
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
      description: `Moved to ${categoryName(to, categoriesOfTicket(ticketKey))}`,
    })
  }

  return {
    projects,
    tickets,
    activity,
    comments,
    newEventIds,
    newTicketKeys,
    newCommentIds,
    newProjectKeys,
    categoriesOf,
    createProject,
    createTicket,
    moveTicket,
    setTags,
    createCategory,
    updateCategory,
    deleteCategory,
    comment,
    approve,
    requestChanges,
  }
}

type ProjectsStore = ReturnType<typeof useProjectsState>
const ProjectsContext = createContext<ProjectsStore | null>(null)

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const store = useProjectsState()
  return (
    <ProjectsContext.Provider value={store}>
      {/* reducedMotion="user": motion skips animations when the OS asks for less motion */}
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </ProjectsContext.Provider>
  )
}

export function useProjects() {
  const store = useContext(ProjectsContext)
  if (!store)
    throw new Error("useProjects must be used inside <ProjectsProvider>")
  return store
}
