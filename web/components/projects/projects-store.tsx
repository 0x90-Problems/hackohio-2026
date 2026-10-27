"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"
import { MotionConfig } from "motion/react"
import { toast } from "sonner"

import { ACTOR_TYPES, EVENT_ACTIONS } from "@/shared/names"
import type {
  Actor,
  Agent,
  Category,
  Comment,
  Event,
  Project,
  Ticket,
} from "@/lib/types"
import { useAuthUser } from "@/components/auth/auth-gate"
import {
  CURRENT_USER_ID,
  projectKeyOf,
} from "@/lib/mock-data"
import { loadBoard, removeProject, removeTicketRecord, saveComment, saveEvent, saveProject, saveTicket, saveTicketQuiet } from "@/lib/board-db"
import { readSession } from "@/lib/board-auth"
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

// Wait until typing pauses before writing the description. A burst of
// keystrokes stays one save and one change-history version.
const DESCRIPTION_PAUSE_MS = 700

function reportDescriptionSave(error: unknown) {
  toast.error("Couldn't save to the database", {
    description: error instanceof Error ? error.message : undefined,
  })
}

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
  // Empty until DocDB load — mock CLW/PIT/ST must not appear after a wipe.
  const [projects, setProjects] = useState<Project[]>([])
  const [tickets, setTicketsState] = useState<Ticket[]>([])
  // Always-current copy, so several actions in a row (like the assistant
  // creating two tickets at once) see each other's changes.
  const ticketsRef = useRef(tickets)
  const gone = useRef(new Set<string>())
  function setTickets(update: (current: Ticket[]) => Ticket[]) {
    ticketsRef.current = update(ticketsRef.current)
    setTicketsState(ticketsRef.current)
  }
  // Description text before this typing burst. One in-flight save per ticket.
  const descriptionBaseline = useRef(new Map<string, string>())
  const descriptionTimers = useRef(new Map<string, number>())
  const descriptionChain = useRef(new Map<string, Promise<void>>())
  const [activity, setActivity] = useState<Event[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  // Every agent saved in MongoDB, from the same load as the board
  const [boardAgents, setBoardAgents] = useState<Agent[]>([])
  // Remember what arrived after the page loaded, so only those animate in.
  const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set())
  const [newTicketKeys, setNewTicketKeys] = useState<Set<string>>(new Set())
  const [newCommentIds, setNewCommentIds] = useState<Set<string>>(new Set())
  const [newProjectKeys, setNewProjectKeys] = useState<Set<string>>(new Set())

  // Each new action is at least 1ms after the last, so list keys stay unique.
  const clock = useRef(Date.now())
  const now = () => new Date((clock.current = Math.max(Date.now(), clock.current + 1)))
  const me: Actor = { type: ACTOR_TYPES.HUMAN, id: account?._id ?? CURRENT_USER_ID }

  // Reload when dylan (or anyone) signs in — provider stays mounted across /login → /.
  const sessionId = account?._id ?? null

  useEffect(() => {
    let cancelled = false
    async function restore() {
      // Wait for a session before hitting the DocDB-backed board API.
      if (!readSession()?.secret) {
        if (!cancelled) setReady(true)
        return
      }
      const remote = await loadBoard()
      if (cancelled) return
      const local = readStorage<BoardSnapshot>(BOARD_KEY)
      // Signed-in load is source of truth: a wiped DocDB stays empty in the UI.
      // Local-only extras can still merge onto a non-empty remote board.
      const projects = [...remote.projects]
      const tickets = [...remote.tickets]
      const comments = [...remote.comments]
      const activity = [...remote.events].sort(newestFirst)
      const knownTickets = new Set(remote.tickets.map((ticket) => ticket.key))
      const knownProjects = new Set(remote.projects.map((project) => project.key))
      const knownComments = new Set(remote.comments.map((comment) => `${comment.ticket_key}:${comment.created_at.toISOString()}`))
      const knownEvents = new Set(remote.events.map((event) => `${event.action}:${event.ticket_key}:${event.created_at.toISOString()}`))
      // Do not seed mock/local data into DocDB when remote is empty — empty means empty.
      if (remote.projects.length > 0 && local) {
        local.projects.filter((project) => !knownProjects.has(project.key)).forEach(saveProject)
        local.tickets.filter((ticket) => !knownTickets.has(ticket.key)).forEach(saveTicket)
        local.comments
          .filter((comment) => !knownComments.has(`${comment.ticket_key}:${comment.created_at.toISOString()}`))
          .forEach(saveComment)
        local.activity
          .filter((event) => !knownEvents.has(`${event.action}:${event.ticket_key}:${event.created_at.toISOString()}`))
          .forEach(saveEvent)
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
      setBoardAgents(remote.agents ?? [])
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
        ticketsRef.current = []
        setProjects([])
        setTicketsState([])
        setComments([])
        setActivity([])
        setBoardAgents([])
        if (readSession()?.secret) toast.error("Couldn't load the board from the database")
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [sessionId])

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    async function refresh() {
      try {
        const remote = await loadBoard()
        if (cancelled) return
        setProjects((current) => {
          const known = new Set(current.map((project) => project.key))
          const added = remote.projects.filter((project) => !known.has(project.key)).map(withTemplateShape)
          return added.length > 0 ? [...current, ...added] : current
        })
        setTickets((current) => {
          const visible = current.filter((ticket) => !gone.current.has(ticket.key))
          const known = new Set(visible.map((ticket) => ticket.key))
          let changed = visible.length !== current.length
          const next = visible.map((ticket) => {
            const incoming = remote.tickets.find((item) => item.key === ticket.key)
            if (!incoming) return ticket
            const linked = [...(ticket.linked_commits ?? [])]
            const seen = new Set(linked.map((commit) => commit.sha))
            for (const commit of incoming.linked_commits ?? []) {
              if (seen.has(commit.sha)) continue
              linked.push(commit)
              seen.add(commit.sha)
            }
            const createdBy = ticket.created_by.name ? ticket.created_by : incoming.created_by
            const same =
              incoming.status === ticket.status &&
              incoming.title === ticket.title &&
              linked.length === (ticket.linked_commits?.length ?? 0) &&
              createdBy === ticket.created_by
            if (same) return ticket
            changed = true
            return { ...ticket, title: incoming.title, status: incoming.status, linked_commits: linked, created_by: createdBy }
          })
          for (const incoming of remote.tickets) {
            if (gone.current.has(incoming.key) || known.has(incoming.key)) continue
            changed = true
            next.push(incoming)
          }
          return changed ? next : current
        })
        setComments((current) => {
          const known = new Set(current.map((comment) => `${comment.ticket_key}:${comment.created_at.toISOString()}:${comment.body}`))
          const kept = current.filter((comment) => !gone.current.has(comment.ticket_key))
          const added = remote.comments.filter(
            (comment) => !gone.current.has(comment.ticket_key) && !known.has(`${comment.ticket_key}:${comment.created_at.toISOString()}:${comment.body}`),
          )
          return added.length > 0 || kept.length !== current.length ? [...kept, ...added] : current
        })
        setActivity((current) => {
          const known = new Set(
            current.map((event) => `${event.action}:${event.ticket_key}:${event.created_at.toISOString()}:${event.details?.body ?? ""}:${event.details?.sha ?? ""}`),
          )
          const kept = current.filter((event) => !gone.current.has(event.ticket_key))
          const added = remote.events.filter(
            (event) => !gone.current.has(event.ticket_key) && !known.has(`${event.action}:${event.ticket_key}:${event.created_at.toISOString()}:${event.details?.body ?? ""}:${event.details?.sha ?? ""}`),
          )
          return added.length > 0 || kept.length !== current.length ? [...added, ...kept].sort(newestFirst) : current
        })
      } catch {
        // Keep the last board that loaded.
      }
    }
    const timer = setInterval(() => void refresh(), 4000)
    const onFocus = () => void refresh()
    window.addEventListener("focus", onFocus)
    return () => {
      cancelled = true
      clearInterval(timer)
      window.removeEventListener("focus", onFocus)
    }
  }, [ready])

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
  async function createTicket(
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
    const session = readSession()
    const response = await fetch("/api/board", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(session?.secret ? { authorization: `Bearer ${session.secret}` } : {}),
      },
      body: JSON.stringify({ kind: "allocateKey", projectKey }),
    })
    const body = (await response.json().catch(() => null)) as { key?: string; error?: { message?: string } } | null
    if (!response.ok || typeof body?.key !== "string") {
      const error = new Error(body?.error?.message ?? "Could not assign a ticket key")
      toast.error("Couldn't save to the database", { description: error.message })
      throw error
    }
    const key = body.key
    const created_at = now()
    const ticket: Ticket = {
      key,
      project_key: projectKey,
      title: input.title,
      ...(input.tags.length > 0 && { tags: input.tags }),
      status: input.status,
      ...(input.due_date && { due_date: input.due_date }),
      created_by: actor,
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

  // One save at a time. A newer draft waits, then writes the latest text,
  // so a keystroke cannot collide with the save still in flight.
  function flushDescription(ticketKey: string) {
    const previous = descriptionChain.current.get(ticketKey) ?? Promise.resolve()
    const run = previous.catch(() => undefined).then(async () => {
      if (descriptionTimers.current.has(ticketKey)) return
      if (!descriptionBaseline.current.has(ticketKey)) return
      const ticket = ticketsRef.current.find((item) => item.key === ticketKey)
      if (!ticket) return
      const next = ticket.description ?? ""
      const baseline = descriptionBaseline.current.get(ticketKey) ?? ""
      if (next === baseline) {
        descriptionBaseline.current.delete(ticketKey)
        return
      }
      try {
        await saveTicketQuiet(ticket)
      } catch (error) {
        const latest = ticketsRef.current.find((item) => item.key === ticketKey)?.description ?? ""
        const stillTyping = descriptionTimers.current.has(ticketKey) || latest !== next
        // A version conflict from this burst is retried with the latest text.
        // A conflict that remains after typing stops is still reported.
        if (stillTyping) return
        reportDescriptionSave(error)
        return
      }
      const latest = ticketsRef.current.find((item) => item.key === ticketKey)?.description ?? ""
      if (latest !== next || descriptionTimers.current.has(ticketKey)) {
        if (!descriptionTimers.current.has(ticketKey)) {
          descriptionTimers.current.set(
            ticketKey,
            window.setTimeout(() => {
              descriptionTimers.current.delete(ticketKey)
              flushDescription(ticketKey)
            }, 0)
          )
        }
        return
      }
      addEvent({
        action: EVENT_ACTIONS.TICKET_UPDATED,
        ticket_key: ticketKey,
        actor: me,
        details: { body: next ? `Description: ${next}` : "Cleared the description" },
        created_at: now(),
      })
      if ((ticketsRef.current.find((item) => item.key === ticketKey)?.description ?? "") === next) {
        descriptionBaseline.current.delete(ticketKey)
      }
    })
    descriptionChain.current.set(ticketKey, run)
  }

  function setDescription(ticketKey: string, description: string, commit = false) {
    if (!descriptionBaseline.current.has(ticketKey)) {
      const current = ticketsRef.current.find((ticket) => ticket.key === ticketKey)
      descriptionBaseline.current.set(ticketKey, current?.description ?? "")
    }
    setTickets((current) =>
      current.map((ticket) =>
        ticket.key === ticketKey ? { ...ticket, description } : ticket
      )
    )
    const pending = descriptionTimers.current.get(ticketKey)
    if (pending) window.clearTimeout(pending)
    const baseline = descriptionBaseline.current.get(ticketKey) ?? ""
    if ((description ?? "") === baseline) {
      descriptionTimers.current.delete(ticketKey)
      descriptionBaseline.current.delete(ticketKey)
      return
    }
    if (commit) {
      descriptionTimers.current.delete(ticketKey)
      flushDescription(ticketKey)
      return
    }
    descriptionTimers.current.set(
      ticketKey,
      window.setTimeout(() => {
        descriptionTimers.current.delete(ticketKey)
        flushDescription(ticketKey)
      }, DESCRIPTION_PAUSE_MS)
    )
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

  async function removeTicket(ticketKey: string) {
    const ticket = ticketsRef.current.find((item) => item.key === ticketKey)
    if (!ticket) return
    const ticketsSnapshot = ticketsRef.current
    const commentsSnapshot = comments
    const activitySnapshot = activity
    gone.current.add(ticketKey)
    setTickets((current) => current.filter((item) => item.key !== ticketKey))
    setComments((current) => current.filter((item) => item.ticket_key !== ticketKey))
    setActivity((current) => current.filter((item) => item.ticket_key !== ticketKey))
    try {
      await removeTicketRecord(ticketKey)
    } catch (error) {
      gone.current.delete(ticketKey)
      setTickets(() => ticketsSnapshot)
      setComments(commentsSnapshot)
      setActivity(activitySnapshot)
      toast.error("Couldn't delete the ticket", {
        description: error instanceof Error ? error.message : "The delete failed",
      })
      return
    }
    toast.success(`Deleted ${ticketKey}`)
  }

  const flushDescriptionRef = useRef(flushDescription)
  flushDescriptionRef.current = flushDescription

  useEffect(() => {
    function flushPending() {
      for (const [ticketKey, timer] of [...descriptionTimers.current]) {
        window.clearTimeout(timer)
        descriptionTimers.current.delete(ticketKey)
        flushDescriptionRef.current(ticketKey)
      }
    }
    window.addEventListener("pagehide", flushPending)
    return () => {
      window.removeEventListener("pagehide", flushPending)
      flushPending()
    }
  }, [])

  return {
    ready,
    projects,
    tickets,
    // Latest tickets, including changes made earlier in the same click
    getTickets: () => ticketsRef.current,
    activity,
    comments,
    boardAgents,
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
