// The board assistant's tools. The chat route (app/api/chat) sends these
// definitions to the model on Bedrock; the browser runs them against projects-store, so the
// assistant changes the same data the board shows. The offline assistant
// (./offline.ts) calls runTool directly.
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
  ASSISTANT_AGENT_ID,
  CURRENT_USER_ID,
  currentUser,
} from "@/lib/mock-data"
import { categoryName } from "@/lib/categories"

// Everything the assistant acts as: an agent acting for the signed-in person
// (the demo user when nobody is signed in)
export function assistantActor(ctx: ToolContext): Actor {
  return {
    type: ACTOR_TYPES.AGENT,
    id: ASSISTANT_AGENT_ID,
    name: "Nutty",
    acting_for: ctx.user?.id ?? CURRENT_USER_ID,
  }
}

// The slice of projects-store the tools need
export type AssistantStore = {
  projects: Project[]
  getTickets: () => Ticket[]
  comments: Comment[]
  activity: Event[]
  categoriesOf: (projectKey: string) => Category[]
  createTicket: (
    projectKey: string,
    input: { title: string; status: string; tags: string[] },
    actor: Actor
  ) => string
  moveTicket: (ticketKey: string, to: string, actor: Actor) => void
  comment: (ticketKey: string, body: string, actor: Actor) => void
}

export type ToolContext = {
  store: AssistantStore
  currentProjectKey: string
  // The person the assistant acts for
  user?: { id: string; name: string }
}

// What the chat shows under a reply, e.g. "Moved CLW-12 → In progress"
export type ToolAction = { label: string; ticketKey?: string }

export type ToolOutcome = {
  result: unknown
  isError?: boolean
  action?: ToolAction
}

const object = (properties: Record<string, unknown>, required: string[]) => ({
  type: "object" as const,
  properties,
  required,
  additionalProperties: false,
})
const str = (description: string) => ({ type: "string", description })

// A tool the model can call. runTool checks every input itself before using
// it, since the model can send anything.
export type ToolDefinition = {
  name: string
  description: string
  input_schema: ReturnType<typeof object>
}

export const ASSISTANT_TOOLS: ToolDefinition[] = [
  {
    name: "get_board",
    description:
      "Get the signed-in user, the project they are looking at, and every project with its columns (slug and name). Call this first to learn valid project keys and column slugs.",
    input_schema: object({}, []),
  },
  {
    name: "list_tickets",
    description:
      "List every ticket in a project: key, title, column, tags, who made it, reviewer, and whether it needs human approval.",
    input_schema: object({ project_key: str("Project key, e.g. CLW") }, [
      "project_key",
    ]),
  },
  {
    name: "get_ticket",
    description:
      "Get one ticket with its linked commits, comments and change history. Use it to summarize a ticket.",
    input_schema: object({ ticket_key: str("Ticket id, e.g. CLW-16") }, [
      "ticket_key",
    ]),
  },
  {
    name: "create_ticket",
    description:
      "Create a ticket. It is recorded as made by you (an agent) acting for the user.",
    input_schema: object(
      {
        project_key: str("Project key, e.g. CLW"),
        title: str("Short title, in sentence case"),
        status: str("Column slug from get_board, usually the first column"),
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags, may be empty",
        },
      },
      ["project_key", "title", "status", "tags"]
    ),
  },
  {
    name: "move_ticket",
    description:
      "Move a ticket to another column. You cannot move tickets into the done column: a human approves those.",
    input_schema: object(
      {
        ticket_key: str("Ticket id, e.g. CLW-12"),
        status: str("Column slug from get_board"),
      },
      ["ticket_key", "status"]
    ),
  },
  {
    name: "add_comment",
    description: "Comment on a ticket as the assistant.",
    input_schema: object(
      { ticket_key: str("Ticket id, e.g. CLW-05"), body: str("The comment") },
      ["ticket_key", "body"]
    ),
  },
]

export const ASSISTANT_SYSTEM_PROMPT = `You are Nutty, the friendly assistant inside NutShell, a project board where people and AI agents work on the same tickets. You are an agent acting for the signed-in user, and everything you change is shown on the board as done by "Nutty".

Use the tools to answer questions about projects and tickets and to make changes the user asks for. Look things up instead of guessing ticket ids or column names; call get_board first in a conversation. Only say you changed something after the tool succeeded.

You can't approve tickets or move them to Done: a human has to click Approve on the ticket. When asked, explain that and point to the ticket.

Be warm and lightly playful (an occasional nut pun is fine), but keep it professional. Reply in plain text (no markdown headings or tables), in one to four short sentences. Mention ticket ids like CLW-16 so the user can open them; never write links or URLs, since you don't know the board's address.`

const fail = (message: string): ToolOutcome => ({
  result: { error: message },
  isError: true,
})
const isText = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== ""
const projectKeyOf = (ticketKey: string) => ticketKey.split("-")[0]

// The done column a human must approve into: "done", else the last column
function doneSlug(categories: Category[]) {
  return categories.some((c) => c.slug === TICKET_STATUS.DONE)
    ? TICKET_STATUS.DONE
    : categories.at(-1)?.slug
}

function describeTicket(t: Ticket, categories: Category[]) {
  return {
    key: t.key,
    title: t.title,
    column: categoryName(t.status, categories),
    column_slug: t.status,
    tags: t.tags ?? [],
    created_by: t.created_by,
    reviewer_id: t.reviewer_id ?? null,
    needs_approval: t.needs_approval,
  }
}

// Runs one tool call against the store. Inputs come from the model (or the
// offline parser), so every field is checked before use.
export function runTool(
  name: string,
  input: unknown,
  ctx: ToolContext
): ToolOutcome {
  const { store } = ctx
  const args = (input && typeof input === "object" ? input : {}) as Record<
    string,
    unknown
  >
  const findTicket = (key: unknown) =>
    isText(key)
      ? store.getTickets().find((t) => t.key === key.trim().toUpperCase())
      : undefined

  switch (name) {
    case "get_board":
      return {
        result: {
          current_user: ctx.user ?? { id: CURRENT_USER_ID, name: currentUser.name },
          current_project: ctx.currentProjectKey,
          projects: store.projects.map((p) => ({
            key: p.key,
            name: p.name,
            columns: store
              .categoriesOf(p.key)
              .map((c) => ({ slug: c.slug, name: c.name })),
          })),
        },
      }

    case "list_tickets": {
      const key = isText(args.project_key)
        ? args.project_key.trim().toUpperCase()
        : ""
      if (!store.projects.some((p) => p.key === key))
        return fail(`No project "${args.project_key}".`)
      const categories = store.categoriesOf(key)
      return {
        result: store
          .getTickets()
          .filter((t) => projectKeyOf(t.key) === key)
          .map((t) => describeTicket(t, categories)),
      }
    }

    case "get_ticket": {
      const ticket = findTicket(args.ticket_key)
      if (!ticket) return fail(`No ticket "${args.ticket_key}".`)
      const categories = store.categoriesOf(projectKeyOf(ticket.key))
      return {
        result: {
          ...describeTicket(ticket, categories),
          linked_commits: ticket.linked_commits ?? [],
          comments: store.comments
            .filter((c) => c.ticket_key === ticket.key)
            .map((c) => ({ author: c.author, body: c.body })),
          history: store.activity
            .filter(
              (e) =>
                e.ticket_key === ticket.key &&
                e.action !== EVENT_ACTIONS.COMMENT_ADDED
            )
            .reverse()
            .map((e) => ({
              action: e.action,
              actor: e.actor,
              details: e.details ?? {},
            })),
        },
      }
    }

    case "create_ticket": {
      const key = isText(args.project_key)
        ? args.project_key.trim().toUpperCase()
        : ""
      if (!store.projects.some((p) => p.key === key))
        return fail(`No project "${args.project_key}".`)
      if (!isText(args.title)) return fail("title is required.")
      const categories = store.categoriesOf(key)
      const status = categories.some((c) => c.slug === args.status)
        ? (args.status as string)
        : categories[0].slug
      const tags = Array.isArray(args.tags)
        ? args.tags.filter(isText).map((t) => t.trim())
        : []
      const title = args.title.trim().slice(0, 200)
      const ticketKey = store.createTicket(
        key,
        { title, status, tags },
        assistantActor(ctx)
      )
      return {
        result: {
          created: ticketKey,
          column: categoryName(status, categories),
        },
        action: { label: `Created ${ticketKey} · ${title}`, ticketKey },
      }
    }

    case "move_ticket": {
      const ticket = findTicket(args.ticket_key)
      if (!ticket) return fail(`No ticket "${args.ticket_key}".`)
      const categories = store.categoriesOf(projectKeyOf(ticket.key))
      const target = categories.find((c) => c.slug === args.status)
      if (!target)
        return fail(`No column "${args.status}". Use a slug from get_board.`)
      if (target.slug === doneSlug(categories)) {
        return fail(
          "Agents can't move tickets to Done. A human has to click Approve on the ticket."
        )
      }
      if (ticket.status === target.slug)
        return { result: { unchanged: true, column: target.name } }
      store.moveTicket(ticket.key, target.slug, assistantActor(ctx))
      return {
        result: { moved: ticket.key, column: target.name },
        action: {
          label: `Moved ${ticket.key} → ${target.name}`,
          ticketKey: ticket.key,
        },
      }
    }

    case "add_comment": {
      const ticket = findTicket(args.ticket_key)
      if (!ticket) return fail(`No ticket "${args.ticket_key}".`)
      if (!isText(args.body)) return fail("body is required.")
      store.comment(
        ticket.key,
        args.body.trim().slice(0, 2000),
        assistantActor(ctx)
      )
      return {
        result: { commented: ticket.key },
        action: { label: `Commented on ${ticket.key}`, ticketKey: ticket.key },
      }
    }

    default:
      return fail(`Unknown tool "${name}".`)
  }
}
