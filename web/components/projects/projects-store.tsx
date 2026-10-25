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
import { useAuthUser } from "@/components/auth/auth-gate"
import {
  MOCK_NOW,
  comments as allComments,
  events as allEvents,
  projectKeyOf,
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
import { templateCategories, type ProjectTemplate } from "@/lib/templates"
import { commentId } from "@/components/board/ticket-modal"

// CLW-05 -> CLW
export { projectKeyOf }

const newestFirst = <T extends { created_at: Date }>(a: T, b: T) =>
  b.created_at.getTime() - a.created_at.getTime()

// Holds every project's board in one place, so moves, categories and tags
// survive switching pages. Mounted once in app/layout.tsx. Still mock data:
// a reload starts over.
function useProjectsState() {
  const [projects, setProjects] = useState<Project[]>(allProjects)
  const [tickets, setTicketsState] = useState<Ticket[]>(allTickets)
  // Always-current copy, so several actions in a row (like the assistant
  // creating two tickets at once) see each other's changes.
  const ticketsRef = useRef(tickets)
  function setTickets(update: (current: Ticket[]) => Ticket[]) {
    ticketsRef.current = update(ticketsRef.current)
    setTicketsState(ticketsRef.current)
  }
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
  const account = useAuthUser()
  const me: Actor = { type: ACTOR_TYPES.HUMAN, id: account?._id ?? "" }

  // Each project keeps its own columns (projects.categories in the schema)
  const categoriesOf = (projectKey: string) =>
    projects.find((p) => p.key === projectKey)?.categories ?? DEFAULT_CATEGORIES
  const categoriesOfTicket = (ticketKey: string) =>
    categoriesOf(projectKeyOf(ticketKey))

  function setProjectCategories(
    projectKey: string,
    update: (current: Category[]) => Category[]
  ) {
    setProjects((all) =>
      all.map((p) =>
        p.key === projectKey ? { ...p, categories: update(p.categories) } : p
      )
    )
  }

  function addComment(comment: Comment) {
    setComments((current) => [...current, comment])
    setNewCommentIds((ids) => new Set(ids).add(commentId(comment)))
  }

  // Fills in project_key from the ticket id
  function addEvent(input: Omit<Event, "project_key">) {
    const event: Event = {
      ...input,
      project_key: projectKeyOf(input.ticket_key),
    }
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

  // Every tag used on a project's tickets, plus its template's starter tags
  const tagsOf = (projectKey: string) =>
    [
      ...new Set([
        ...(projects.find((p) => p.key === projectKey)?.starter_tags ?? []),
        ...tickets
          .filter((t) => projectKeyOf(t.key) === projectKey)
          .flatMap((t) => t.tags ?? []),
      ]),
    ].sort()

  function createProject({
    template,
    ...input
  }: {
    name: string
    key: string
    description?: string
    team: string
    template: ProjectTemplate
  }) {
    const project: Project = {
      ...input,
      template: template.id,
      categories: templateCategories(template),
      ...(template.tags.length > 0 && { starter_tags: template.tags }),
      created_by: me,
      created_at: now(),
    }
    setProjects((current) => [...current, project])
    setNewProjectKeys((keys) => new Set(keys).add(project.key))
    toast.success(`Created project ${project.name}`, {
      description: `Tickets will be ${project.key}-01, ${project.key}-02 …`,
    })
  }

  // `actor` is who did it: the signed-in person by default, or an agent
  // (the chat assistant) acting for them.
  function createTicket(
    projectKey: string,
    input: {
      title: string
      status: string
      tags: string[]
      due_date?: string
    },
    actor: Actor = me
  ) {
    const numbers = ticketsRef.current
      .filter((t) => projectKeyOf(t.key) === projectKey)
      .map((t) => Number(t.key.split("-")[1]))
    const key = `${projectKey}-${String(Math.max(0, ...numbers) + 1).padStart(2, "0")}`
    const created_at = now()
    const ticket: Ticket = {
      key,
      project_key: projectKey,
      title: input.title,
      ...(input.tags.length > 0 && { tags: input.tags }),
      status: input.status,
      ...(input.due_date && { due_date: input.due_date }),
      created_by: actor,
      needs_approval: false,
      created_at,
    }
    setTickets((current) => [ticket, ...current])
    setNewTicketKeys((keys) => new Set(keys).add(key))
    addEvent({
      action: EVENT_ACTIONS.TICKET_CREATED,
      ticket_key: key,
      actor,
      details: { status: input.status },
      created_at,
    })
    toast.success(`Created ${key}`, { description: input.title })
    return key
  }

  // Move a ticket to another column (drag and drop, or the panel's picker)
  function moveTicket(ticketKey: string, to: string, actor: Actor = me) {
    const ticket = ticketsRef.current.find((t) => t.key === ticketKey)
    if (!ticket || ticket.status === to) return
    setStatus(ticketKey, to)
    addEvent({
      action: EVENT_ACTIONS.TICKET_MOVED,
      ticket_key: ticketKey,
      actor,
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

  function setDescription(ticketKey: string, description: string) {
    setTickets((current) =>
      current.map((ticket) =>
        ticket.key === ticketKey ? { ...ticket, description } : ticket
      )
    )
  }

  function setTicketColor(ticketKey: string, card_color?: CategoryColor) {
    setTickets((current) =>
      current.map((ticket) =>
        ticket.key === ticketKey ? { ...ticket, card_color } : ticket
      )
    )
  }

  function setDueDate(ticketKey: string, due_date: string) {
    setTickets((current) =>
      current.map((ticket) => {
        if (ticket.key !== ticketKey) return ticket
        if (due_date) return { ...ticket, due_date }
        const withoutDueDate = { ...ticket }
        delete withoutDueDate.due_date
        return withoutDueDate
      })
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

  function comment(ticketKey: string, body: string, actor: Actor = me) {
    const created_at = now()
    addComment({ ticket_key: ticketKey, author: actor, body, created_at })
    addEvent({
      action: EVENT_ACTIONS.COMMENT_ADDED,
      ticket_key: ticketKey,
      actor,
      created_at,
    })
  }

  // A shared status word if that column still exists, otherwise the ticket's current column
  const columnOr = (slug: string, ticketKey: string) =>
    categoriesOfTicket(ticketKey).some((c) => c.slug === slug)
      ? slug
      : (ticketsRef.current.find((t) => t.key === ticketKey)?.status ?? slug)

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
    // Latest tickets, including changes made earlier in the same click
    getTickets: () => ticketsRef.current,
    activity,
    comments,
    newEventIds,
    newTicketKeys,
    newCommentIds,
    newProjectKeys,
    categoriesOf,
    tagsOf,
    createProject,
    createTicket,
    moveTicket,
    setTags,
    setDescription,
    setTicketColor,
    setDueDate,
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
