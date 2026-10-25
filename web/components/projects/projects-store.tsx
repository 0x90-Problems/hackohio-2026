"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"
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
  CURRENT_USER_ID,
  comments as allComments,
  events as allEvents,
  projectKeyOf,
  projects as allProjects,
  tickets as allTickets,
} from "@/lib/mock-data"
import { loadBoard, removeProject, removeTicketRecord, saveComment, saveEvent, saveProject, saveTicket } from "@/lib/board-db"
import { readStorage } from "@/lib/local-store"
import {
  DEFAULT_CATEGORIES,
  categoryName,
  makeSlug,
  type CategoryColor,
} from "@/lib/categories"
import { eventId } from "@/lib/format"
import {
  resolvedProjectFields,
  resolvedProjectLayout,
  templateCategories,
  type ProjectTemplate,
} from "@/lib/templates"
import { commentId } from "@/components/board/ticket-modal"

// CLW-05 -> CLW
export { projectKeyOf }

const newestFirst = <T extends { created_at: Date }>(a: T, b: T) =>
  b.created_at.getTime() - a.created_at.getTime()

const BOARD_KEY = "buck2.board"

// Older saved projects stored the template id and dropped layout and fields.
function withTemplateShape(project: Project): Project {
  return {
    ...project,
    layout: resolvedProjectLayout(project),
    fields: resolvedProjectFields(project),
  }
}

type BoardSnapshot = {
  projects: Project[]
  tickets: Ticket[]
  activity: Event[]
  comments: Comment[]
}

// Holds every project's board in one place, so moves, categories and tags
// survive switching pages. Mounted once in app/layout.tsx. A reload reads
// projects, tickets, comments, and events back from MongoDB.
function useProjectsState() {
  const account = useAuthUser()
  const [ready, setReady] = useState(false)
  const [projects, setProjects] = useState<Project[]>(() => allProjects.map(withTemplateShape))
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

  // Each new action is at least 1ms after the last, so list keys stay unique.
  const clock = useRef(Date.now())
  const now = () => new Date((clock.current = Math.max(Date.now(), clock.current + 1)))
  const me: Actor = { type: ACTOR_TYPES.HUMAN, id: account?._id ?? CURRENT_USER_ID }

  useEffect(() => {
    let cancelled = false
    async function restore() {
      const remote = await loadBoard()
      if (cancelled) return
      const local = readStorage<BoardSnapshot>(BOARD_KEY)
      const projects = remote.projects.length > 0 ? remote.projects : (local?.projects ?? allProjects)
      const tickets = remote.tickets.length > 0 ? remote.tickets : (local?.tickets ?? allTickets)
      const comments = remote.comments.length > 0 ? remote.comments : (local?.comments ?? allComments)
      const activity = [...(remote.events.length > 0 ? remote.events : (local?.activity ?? allEvents))].sort(newestFirst)
      const knownTickets = new Set(remote.tickets.map((ticket) => ticket.key))
      const knownProjects = new Set(remote.projects.map((project) => project.key))
      const knownComments = new Set(remote.comments.map((comment) => `${comment.ticket_key}:${comment.created_at.toISOString()}`))
      const knownEvents = new Set(remote.events.map((event) => `${event.action}:${event.ticket_key}:${event.created_at.toISOString()}`))
      if (remote.projects.length === 0) projects.forEach(saveProject)
      if (remote.tickets.length === 0) tickets.forEach(saveTicket)
      if (remote.comments.length === 0) comments.forEach(saveComment)
      if (remote.events.length === 0) activity.forEach(saveEvent)
      local?.projects.filter((project) => !knownProjects.has(project.key)).forEach(saveProject)
      local?.tickets.filter((ticket) => !knownTickets.has(ticket.key)).forEach(saveTicket)
      local?.comments
        .filter((comment) => !knownComments.has(`${comment.ticket_key}:${comment.created_at.toISOString()}`))
        .forEach(saveComment)
      local?.activity
        .filter((event) => !knownEvents.has(`${event.action}:${event.ticket_key}:${event.created_at.toISOString()}`))
        .forEach(saveEvent)
      if (local && remote.projects.length > 0) {
        const extraProjects = local.projects.filter((project) => !knownProjects.has(project.key))
        const extraTickets = local.tickets.filter((ticket) => !knownTickets.has(ticket.key))
        const extraComments = local.comments.filter(
          (comment) => !knownComments.has(`${comment.ticket_key}:${comment.created_at.toISOString()}`)
        )
        const extraEvents = local.activity.filter(
          (event) => !knownEvents.has(`${event.action}:${event.ticket_key}:${event.created_at.toISOString()}`)
        )
        projects.push(...extraProjects)
        tickets.push(...extraTickets)
        comments.push(...extraComments)
        activity.unshift(...extraEvents)
      }
      ticketsRef.current = tickets
      setProjects(projects.map(withTemplateShape))
      setTicketsState(tickets)
      setComments(comments)
      setActivity(activity)
      const latest = Math.max(
        0,
        ...projects.map((item) => item.created_at.getTime()),
        ...tickets.map((item) => item.created_at.getTime()),
        ...activity.map((item) => item.created_at.getTime()),
        ...comments.map((item) => item.created_at.getTime())
      )
      if (latest > clock.current) clock.current = latest
      localStorage.removeItem(BOARD_KEY)
    }
    restore()
      .catch(() => {
        setProjects((current) => current.map(withTemplateShape))
        toast.error("Couldn't load the board from the database")
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

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
      all.map((p) => {
        if (p.key !== projectKey) return p
        const next = { ...p, categories: update(p.categories) }
        saveProject(next)
        return next
      })
    )
  }

  function addComment(comment: Comment) {
    setComments((current) => [...current, comment])
    setNewCommentIds((ids) => new Set(ids).add(commentId(comment)))
    saveComment(comment)
  }

  // Fills in project_key from the ticket id
  function addEvent(input: Omit<Event, "project_key">) {
    const event: Event = {
      ...input,
      project_key: projectKeyOf(input.ticket_key),
    }
    setActivity((current) => [event, ...current])
    setNewEventIds((ids) => new Set(ids).add(eventId(event)))
    saveEvent(event)
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
    const updated = ticketsRef.current.find((ticket) => ticket.key === ticketKey)
    if (updated) saveTicket(updated)
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
      layout: template.layout,
      fields: [...template.fields],
      categories: templateCategories(template),
      ...(template.tags.length > 0 && { starter_tags: template.tags }),
      created_by: me,
      created_at: now(),
    }
    setProjects((current) => [...current, project])
    setNewProjectKeys((keys) => new Set(keys).add(project.key))
    saveProject(project)
    toast.success(`Created project ${project.name}`, {
      description: `Tickets will be ${project.key}-01, ${project.key}-02 …`,
    })
  }

  function archiveProject(key: string, archived: boolean) {
    const project = projects.find((item) => item.key === key)
    if (!project) return
    const next = { ...project, archived }
    setProjects((current) => current.map((item) => (item.key === key ? next : item)))
    saveProject(next)
    toast.success(archived ? `Archived ${project.name}` : `Restored ${project.name}`)
  }

  function deleteProject(key: string) {
    const project = projects.find((item) => item.key === key)
    if (!project) return
    const belongs = (ticketKey: string) => projectKeyOf(ticketKey) === key
    setProjects((current) => current.filter((item) => item.key !== key))
    setTickets((current) => current.filter((ticket) => !belongs(ticket.key)))
    setComments((current) => current.filter((comment) => !belongs(comment.ticket_key)))
    setActivity((current) => current.filter((event) => event.project_key !== key && !belongs(event.ticket_key)))
    void removeProject(key)
    toast.success(`Deleted ${project.name}`)
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
    const stamp = now().getTime()
    const recent = ticketsRef.current.find(
      (ticket) =>
        projectKeyOf(ticket.key) === projectKey &&
        ticket.title === input.title &&
        ticket.created_by.type === actor.type &&
        ticket.created_by.id === actor.id &&
        stamp - ticket.created_at.getTime() < 10_000
    )
    if (recent) return recent.key
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
      needs_approval: true,
      created_at,
    }
    setTickets((current) => [ticket, ...current])
    setNewTicketKeys((keys) => new Set(keys).add(key))
    saveTicket(ticket)
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
    if (to === TICKET_STATUS.DONE && ticket.needs_approval) {
      toast.error(`A different person has to approve ${ticketKey} before it can close`)
      return
    }
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

  function persistTicket(ticketKey: string) {
    const updated = ticketsRef.current.find((ticket) => ticket.key === ticketKey)
    if (updated) saveTicket(updated)
  }

  function setTags(ticketKey: string, tags: string[]) {
    setTickets((current) =>
      current.map((t) => (t.key === ticketKey ? { ...t, tags } : t))
    )
    persistTicket(ticketKey)
    addEvent({
      action: EVENT_ACTIONS.TICKET_UPDATED,
      ticket_key: ticketKey,
      actor: me,
      details: { body: tags.length ? `Tags: ${tags.join(", ")}` : "Cleared the tags" },
      created_at: now(),
    })
  }

  function setDescription(ticketKey: string, description: string) {
    setTickets((current) =>
      current.map((ticket) =>
        ticket.key === ticketKey ? { ...ticket, description } : ticket
      )
    )
    persistTicket(ticketKey)
    addEvent({
      action: EVENT_ACTIONS.TICKET_UPDATED,
      ticket_key: ticketKey,
      actor: me,
      details: { body: description ? `Description: ${description}` : "Cleared the description" },
      created_at: now(),
    })
  }

  function setTicketColor(ticketKey: string, card_color?: CategoryColor) {
    setTickets((current) =>
      current.map((ticket) =>
        ticket.key === ticketKey ? { ...ticket, card_color } : ticket
      )
    )
    persistTicket(ticketKey)
  }

  function setReviewer(ticketKey: string, reviewer_id: string) {
    setTickets((current) =>
      current.map((ticket) => {
        if (ticket.key !== ticketKey) return ticket
        if (reviewer_id) return { ...ticket, reviewer_id }
        const next = { ...ticket }
        delete next.reviewer_id
        return next
      })
    )
    persistTicket(ticketKey)
    addEvent({
      action: EVENT_ACTIONS.TICKET_UPDATED,
      ticket_key: ticketKey,
      actor: me,
      details: { body: reviewer_id ? `Reviewer: ${reviewer_id}` : "Reviewer cleared" },
      created_at: now(),
    })
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
    persistTicket(ticketKey)
    addEvent({
      action: EVENT_ACTIONS.TICKET_UPDATED,
      ticket_key: ticketKey,
      actor: me,
      details: { body: due_date ? `Due date: ${due_date}` : "Cleared the due date" },
      created_at: now(),
    })
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
    ticketsRef.current
      .filter((ticket) => projectKeyOf(ticket.key) === projectKey && ticket.status === moveTo)
      .forEach(saveTicket)
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
      details: { body },
      created_at,
    })
  }

  // A shared status word if that column still exists, otherwise the ticket's current column
  const columnOr = (slug: string, ticketKey: string) =>
    categoriesOfTicket(ticketKey).some((c) => c.slug === slug)
      ? slug
      : (ticketsRef.current.find((t) => t.key === ticketKey)?.status ?? slug)

  function approve(ticketKey: string) {
    const ticket = ticketsRef.current.find((item) => item.key === ticketKey)
    const creatorId = ticket
      ? ticket.created_by.type === ACTOR_TYPES.AGENT
        ? ticket.created_by.acting_for
        : ticket.created_by.id
      : undefined
    if (creatorId && creatorId === (account?._id ?? CURRENT_USER_ID)) {
      toast.error("You can't approve your own ticket")
      return
    }
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

  function removeTicket(ticketKey: string) {
    const ticket = ticketsRef.current.find((item) => item.key === ticketKey)
    if (!ticket) return
    const creatorId = ticket.created_by.type === ACTOR_TYPES.AGENT ? ticket.created_by.acting_for : ticket.created_by.id
    const mine = (account?._id ?? CURRENT_USER_ID) === creatorId
    if (!mine && account?.admin !== true) {
      toast.error("Only an admin or the creator can delete this ticket")
      return
    }
    setTickets((current) => current.filter((item) => item.key !== ticketKey))
    removeTicketRecord(ticketKey)
    addEvent({
      action: EVENT_ACTIONS.TICKET_DELETED,
      ticket_key: ticketKey,
      actor: me,
      details: { title: ticket.title },
      created_at: now(),
    })
    toast.success(`Deleted ${ticketKey}`)
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
    ready,
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
    archiveProject,
    deleteProject,
    createTicket,
    moveTicket,
    setTags,
    setDescription,
    setTicketColor,
    setDueDate,
    setReviewer,
    deleteTicket: removeTicket,
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
      <MotionConfig reducedMotion="user">{store.ready ? children : null}</MotionConfig>
    </ProjectsContext.Provider>
  )
}

export function useProjects() {
  const store = useContext(ProjectsContext)
  if (!store)
    throw new Error("useProjects must be used inside <ProjectsProvider>")
  return store
}
