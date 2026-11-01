import { DEFAULT_CATEGORIES } from "@/lib/categories"
import type { Actor, Agent, Comment, Event, Project, Ticket } from "@/lib/types"

const TEAM = "0x90 Problems"

type Loose = Record<string, unknown>

export type BoardPayload = {
  projects: Project[]
  tickets: Ticket[]
  comments: Comment[]
  events: Event[]
  agents: Agent[]
}

type NamedUser = { _id: string; name?: string; auth_username?: string; team?: string }
type NamedAgent = { _id: string; name?: string }

function record(value: unknown): Loose | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Loose) : undefined
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined
}

function iso(value: unknown, fallback: "epoch" | "now" = "epoch"): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "string") {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return date.toISOString()
  }
  // Projects historically omitted created_at from the board API; epoch showed as ~20753 d ago.
  return (fallback === "now" ? new Date() : new Date(0)).toISOString()
}

function asActor(value: unknown): Actor | undefined {
  const actor = record(value)
  const id = text(actor?.id)
  if (!actor || !id) return undefined
  const name = text(actor.name)
  if (actor.type === "agent") {
    return {
      type: "agent",
      id,
      acting_for: text(actor.acting_for) ?? "",
      ...(name ? { name } : {}),
    }
  }
  if (actor.type !== "human") return undefined
  return { type: "human", id, ...(name ? { name } : {}) }
}

function displayName(actor: Actor, users: NamedUser[], agents: NamedAgent[]): string | undefined {
  if (actor.name) return actor.name
  if (actor.type === "agent") return text(agents.find((agent) => agent._id === actor.id)?.name)
  const user = users.find((item) => item._id === actor.id || item.auth_username === actor.id)
  return text(user?.name) || text(user?.auth_username) || (actor.id.startsWith("user_") ? actor.id.slice("user_".length) : undefined)
}

function withName(actor: Actor, users: NamedUser[], agents: NamedAgent[]): Actor {
  const name = displayName(actor, users, agents)
  if (!name || actor.name === name) return actor
  return { ...actor, name }
}

function stringFields(value: unknown): Record<string, string> | undefined {
  const source = record(value)
  if (!source) return undefined
  const fields: Record<string, string> = {}
  for (const [key, item] of Object.entries(source)) {
    if (typeof item === "string") fields[key] = item
  }
  return Object.keys(fields).length > 0 ? fields : undefined
}

function commitsOf(value: unknown): Ticket["linked_commits"] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const commit = record(item)
    const sha = text(commit?.sha)
    const message = text(commit?.message)
    if (!commit || !sha || !message) return []
    const added = typeof commit.added === "number" ? commit.added : 0
    const removed = typeof commit.removed === "number" ? commit.removed : 0
    return [{ sha, message, added, removed }]
  })
}

function unionCommits(left: Ticket["linked_commits"], right: Ticket["linked_commits"]): Ticket["linked_commits"] {
  const seen = new Set((left ?? []).map((commit) => commit.sha))
  const next = [...(left ?? [])]
  for (const commit of right ?? []) {
    if (seen.has(commit.sha)) continue
    next.push(commit)
    seen.add(commit.sha)
  }
  return next
}

function ticketFrom(value: unknown, users: NamedUser[], agents: NamedAgent[]): Ticket | undefined {
  const ticket = record(value)
  const key = text(ticket?.key)
  const title = text(ticket?.title)
  const createdBy = asActor(ticket?.created_by)
  if (!ticket || !key || !title || !createdBy || ticket.deleted_at) return undefined
  const tags = Array.isArray(ticket.tags) ? ticket.tags.filter((tag): tag is string => typeof tag === "string") : undefined
  const label = text(ticket.label)
  const fields = stringFields(ticket.fields)
  return {
    key,
    project_key: text(ticket.project_key) ?? key.split("-")[0] ?? "",
    title,
    ...(tags && tags.length > 0 ? { tags } : label ? { tags: [label] } : {}),
    status: text(ticket.status) ?? "backlog",
    created_by: withName(createdBy, users, agents),
    ...(text(ticket.reviewer_id) ? { reviewer_id: text(ticket.reviewer_id) } : {}),
    linked_commits: commitsOf(ticket.linked_commits),
    ...(text(ticket.owner_id) ? { owner_id: text(ticket.owner_id) } : {}),
    ...(text(ticket.start_date) ? { start_date: text(ticket.start_date) } : {}),
    ...(text(ticket.due_date) ? { due_date: text(ticket.due_date) } : {}),
    ...(text(ticket.description) ? { description: text(ticket.description) } : {}),
    ...(text(ticket.card_color) ? { card_color: text(ticket.card_color) as Ticket["card_color"] } : {}),
    ...(fields ? { fields } : {}),
    created_at: new Date(iso(ticket.created_at)),
  }
}

function commentFrom(value: unknown, users: NamedUser[], agents: NamedAgent[]): Comment | undefined {
  const comment = record(value)
  const ticketKey = text(comment?.ticket_key)
  const body = typeof comment?.body === "string" ? comment.body : undefined
  const author = asActor(comment?.author)
  if (!comment || !ticketKey || body === undefined || !author) return undefined
  return {
    ticket_key: ticketKey,
    author: withName(author, users, agents),
    body,
    created_at: new Date(iso(comment.created_at)),
  }
}

function eventFrom(value: unknown, users: NamedUser[], agents: NamedAgent[]): Event | undefined {
  const event = record(value)
  const action = text(event?.action)
  const ticketKey = text(event?.ticket_key)
  const actor = asActor(event?.actor)
  if (!event || !action || !ticketKey || !actor) return undefined
  const details = record(event.details)
  const detailKeys = new Set(["from", "to", "body", "sha", "title", "status"])
  const cleanDetails = details
    ? Object.fromEntries(
        Object.entries(details).filter((entry): entry is [string, string] => detailKeys.has(entry[0]) && typeof entry[1] === "string"),
      )
    : undefined
  return {
    action: action as Event["action"],
    ticket_key: ticketKey,
    project_key: text(event.project_key) ?? ticketKey.split("-")[0] ?? "",
    actor: withName(actor, users, agents),
    ...(cleanDetails && Object.keys(cleanDetails).length > 0 ? { details: cleanDetails } : {}),
    created_at: new Date(iso(event.created_at)),
  }
}

function categoriesFrom(value: unknown): Project["categories"] {
  if (!Array.isArray(value) || value.length === 0) return DEFAULT_CATEGORIES.map((category) => ({ ...category }))
  const categories = value.flatMap((item, order) => {
    const column = record(item)
    const slug = text(column?.slug)
    const name = text(column?.name)
    if (!column || !slug || !name) return []
    const color = text(column.color) ?? "gray"
    return [{
      slug,
      name,
      color: color as Project["categories"][number]["color"],
      order: typeof column.order === "number" ? column.order : order,
    }]
  })
  return categories.length > 0 ? categories : DEFAULT_CATEGORIES.map((category) => ({ ...category }))
}

function projectFrom(value: unknown, team: string, users: NamedUser[], agents: NamedAgent[]): Project | undefined {
  const project = record(value)
  const key = text(project?.key)
  if (!project || !key) return undefined
  const createdBy = asActor(project.created_by) ?? { type: "human" as const, id: "user_board", name: "Board" }
  return {
    key,
    name: text(project.name) ?? key,
    ...(text(project.description) ? { description: text(project.description) } : {}),
    team: text(project.team) ?? team,
    ...(text(project.template) ? { template: text(project.template) as Project["template"] } : {}),
    layout: project.layout === "table" || project.layout === "roadmap" || project.layout === "board" ? project.layout : "board",
    fields: Array.isArray(project.fields) ? project.fields.filter((field): field is string => typeof field === "string") : [],
    categories: categoriesFrom(project.categories ?? project.columns),
    ...(Array.isArray(project.starter_tags) ? { starter_tags: project.starter_tags.filter((tag): tag is string => typeof tag === "string") } : {}),
    created_by: withName(createdBy, users, agents),
    created_at: new Date(iso(project.created_at, "now")),
    ...(project.archived === true ? { archived: true } : {}),
  }
}

function commentKey(comment: Comment): string {
  return `${comment.ticket_key}:${comment.created_at.toISOString()}:${comment.body}`
}

function eventKey(event: Event): string {
  return `${event.action}:${event.ticket_key}:${event.created_at.toISOString()}:${event.details?.body ?? ""}:${event.details?.sha ?? ""}`
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

export function mergeBoardRecords(
  collections: {
    projects?: unknown
    tickets?: unknown
    comments?: unknown
    events?: unknown
    agents?: unknown
  },
  rest: unknown,
  directory: { users?: unknown; agents?: unknown } = {},
): BoardPayload {
  const saved = record(rest)
  const users: NamedUser[] = [...list(directory.users), ...list(saved?.users)].flatMap((item) => {
    const user = record(item)
    const id = text(user?._id)
    if (!user || !id) return []
    return [{ _id: id, name: text(user.name), auth_username: text(user.auth_username), team: text(user.team) }]
  })
  const agents: NamedAgent[] = [...list(directory.agents), ...list(saved?.agents), ...list(collections.agents)].flatMap((item) => {
    const agent = record(item)
    const id = text(agent?._id)
    if (!agent || !id) return []
    return [{ _id: id, name: text(agent.name) }]
  })
  // Projects don't store a team yet, so they all sit under the organization's one team. Never
  // take this from a user: whoever is first in the list would decide which team every project
  // appears on, and the Projects page would hide them all if that's not the team it shows.
  const team = list(collections.projects).map(record).find((project) => text(project?.team))?.team as string | undefined
    ?? TEAM

  const projects = new Map<string, Project>()
  for (const item of list(collections.projects)) {
    const project = projectFrom(item, team, users, agents)
    if (project) projects.set(project.key, project)
  }
  for (const item of list(saved?.projects)) {
    const project = projectFrom(item, team, users, agents)
    if (project && !projects.has(project.key)) projects.set(project.key, project)
  }

  const deleted = new Set<string>()
  for (const item of list(collections.tickets)) {
    const raw = record(item)
    const key = text(raw?.key)
    if (key && raw?.deleted_at) deleted.add(key)
  }
  const tickets = new Map<string, Ticket>()
  for (const item of list(collections.tickets)) {
    const ticket = ticketFrom(item, users, agents)
    if (ticket && !deleted.has(ticket.key)) tickets.set(ticket.key, ticket)
  }
  for (const item of list(saved?.tickets)) {
    const rawKey = text(record(item)?.key)
    if (rawKey && deleted.has(rawKey)) continue
    const ticket = ticketFrom(item, users, agents)
    if (!ticket || deleted.has(ticket.key)) continue
    const existing = tickets.get(ticket.key)
    if (!existing) {
      tickets.set(ticket.key, ticket)
      continue
    }
    if (!existing.title) existing.title = ticket.title
    existing.linked_commits = unionCommits(existing.linked_commits, ticket.linked_commits)
    if (!existing.created_by.name && ticket.created_by.name) existing.created_by = ticket.created_by
    else existing.created_by = withName(existing.created_by, users, agents)
    if (ticket.reviewer_id && !existing.reviewer_id) existing.reviewer_id = ticket.reviewer_id
    if (ticket.start_date && !existing.start_date) existing.start_date = ticket.start_date
    if (ticket.due_date && !existing.due_date) existing.due_date = ticket.due_date
  }

  for (const ticket of tickets.values()) {
    const key = ticket.project_key || ticket.key.split("-")[0]
    if (!key || projects.has(key)) continue
    projects.set(key, {
      key,
      name: key,
      team,
      layout: "board",
      fields: [],
      categories: DEFAULT_CATEGORIES.map((category) => ({ ...category })),
      created_by: withName(ticket.created_by, users, agents),
      created_at: ticket.created_at,
    })
  }

  const comments = new Map<string, Comment>()
  for (const item of [...list(collections.comments), ...list(saved?.comments)]) {
    const comment = commentFrom(item, users, agents)
    if (!comment || deleted.has(comment.ticket_key)) continue
    const key = commentKey(comment)
    const existing = comments.get(key)
    if (!existing) comments.set(key, comment)
    else if (!existing.author.name && comment.author.name) existing.author = comment.author
  }

  const events = new Map<string, Event>()
  for (const item of [...list(collections.events), ...list(saved?.events)]) {
    const event = eventFrom(item, users, agents)
    if (!event || deleted.has(event.ticket_key)) continue
    const key = eventKey(event)
    if (!events.has(key)) events.set(key, event)
  }

  const agentRows = new Map<string, Agent>()
  for (const item of [...list(collections.agents), ...list(saved?.agents)]) {
    const agent = record(item)
    const id = text(agent?._id)
    const name = text(agent?.name)
    if (!agent || !id || !name || agentRows.has(id)) continue
    const connection = agent.connection === "api_key" ? "api_key" : "mcp"
    agentRows.set(id, {
      _id: id,
      name,
      owner_id: text(agent.owner_id) ?? "",
      connection,
      scopes: Array.isArray(agent.scopes) ? agent.scopes.filter((scope): scope is Agent["scopes"][number] => typeof scope === "string") : [],
      revoked: agent.revoked === true,
    })
  }

  return {
    projects: [...projects.values()],
    tickets: [...tickets.values()],
    comments: [...comments.values()],
    events: [...events.values()],
    agents: [...agentRows.values()],
  }
}
