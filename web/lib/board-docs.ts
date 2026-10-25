import { Int32 } from "mongodb"

import type { Actor, Agent, Comment, Event, Project, Ticket } from "@/lib/types"

function actor(value: Actor): Actor {
  if (value.type === "agent") {
    return {
      type: "agent",
      id: value.id,
      acting_for: value.acting_for,
      ...(value.name ? { name: value.name } : {}),
    }
  }
  return { type: "human", id: value.id, ...(value.name ? { name: value.name } : {}) }
}

function when(value: Date | string): Date {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date")
  return date
}

export function projectDoc(project: Project) {
  return {
    key: project.key,
    name: project.name,
    ...(project.description ? { description: project.description } : {}),
    team: project.team,
    ...(project.template ? { template: project.template } : {}),
    layout: project.layout ?? "board",
    fields: project.fields ?? [],
    categories: project.categories.map((category) => ({
      slug: category.slug,
      name: category.name,
      color: category.color,
      order: new Int32(category.order),
    })),
    ...(project.starter_tags?.length ? { starter_tags: project.starter_tags } : {}),
    ...(project.archived ? { archived: true } : {}),
    created_by: actor(project.created_by),
    created_at: when(project.created_at),
  }
}

export function ticketDoc(ticket: Ticket) {
  return {
    key: ticket.key,
    project_key: ticket.project_key,
    title: ticket.title,
    ...(ticket.tags?.length ? { tags: ticket.tags } : {}),
    status: ticket.status,
    created_by: actor(ticket.created_by),
    ...(ticket.reviewer_id ? { reviewer_id: ticket.reviewer_id } : {}),
    ...(ticket.linked_commits?.length ? { linked_commits: ticket.linked_commits } : {}),
    ...(ticket.owner_id ? { owner_id: ticket.owner_id } : {}),
    ...(ticket.due_date ? { due_date: ticket.due_date } : {}),
    ...(ticket.description ? { description: ticket.description } : {}),
    ...(ticket.card_color ? { card_color: ticket.card_color } : {}),
    ...(ticket.fields && Object.keys(ticket.fields).length > 0 ? { fields: ticket.fields } : {}),
    created_at: when(ticket.created_at),
  }
}

export function commentDoc(comment: Comment) {
  const created_at = when(comment.created_at)
  return {
    _id: `${comment.ticket_key}:${created_at.toISOString()}`,
    ticket_key: comment.ticket_key,
    author: actor(comment.author),
    body: comment.body,
    created_at,
  }
}

export function eventDoc(event: Event) {
  const created_at = when(event.created_at)
  return {
    _id: `${event.action}:${event.ticket_key}:${created_at.toISOString()}`,
    action: event.action,
    ticket_key: event.ticket_key,
    project_key: event.project_key,
    actor: actor(event.actor),
    ...(event.details ? { details: event.details } : {}),
    created_at,
  }
}

export function agentDoc(agent: Agent) {
  return {
    _id: agent._id,
    name: agent.name,
    owner_id: agent.owner_id,
    connection: agent.connection,
    scopes: agent.scopes,
    revoked: agent.revoked,
  }
}
