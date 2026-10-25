// The assistant without AI (no AWS set up): understands a handful of phrasings and uses
// the same tools as the AI version, so the demo works with no API key and no
// internet. Anything it doesn't understand gets a short list of examples.
import { ACTOR_TYPES, TICKET_STATUS } from "@/shared/names"
import { categoryName } from "@/lib/categories"
import {
  runTool,
  type ToolAction,
  type ToolContext,
} from "@/lib/assistant/tools"

export type OfflineReply = { text: string; actions: ToolAction[] }

const EXAMPLES = [
  "What's waiting on me?",
  "Summarize CLW-16",
  "Create a ticket to fix the login page",
  "Move CLW-12 to In progress",
  "Comment on CLW-05: looks good",
  "How is the board doing?",
]

const TICKET_KEY = /\b([a-z][a-z0-9]{1,5}-\d+)\b/i

export async function offlineReply(message: string, ctx: ToolContext): Promise<OfflineReply> {
  const text = message.trim()
  const lower = text.toLowerCase()
  const keyMatch = text.match(TICKET_KEY)
  const ticketKey = keyMatch?.[1].toUpperCase()
  const project = ctx.currentProjectKey
  const categories = ctx.store.categoriesOf(project)
  const tickets = ctx.store.getTickets()

  if (/\b(approve|close)\b/.test(lower) && ticketKey) {
    const outcome = await runTool(
      "move_ticket",
      { ticket_key: ticketKey, status: TICKET_STATUS.DONE },
      ctx
    )
    if (outcome.isError)
      return { text: (outcome.result as { error: string }).error, actions: [] }
    if (!outcome.action)
      return { text: `${ticketKey} is already in Done.`, actions: [] }
    return { text: `Done. I moved ${ticketKey} to Done.`, actions: [outcome.action] }
  }

  // "comment on CLW-05: looks good"
  const commentMatch = text.match(
    /comment on\s+([a-z][a-z0-9]{1,5}-\d+)\s*[:,-]?\s*(.+)/i
  )
  if (commentMatch) {
    const outcome = await runTool(
      "add_comment",
      { ticket_key: commentMatch[1], body: commentMatch[2] },
      ctx
    )
    return outcome.isError
      ? { text: (outcome.result as { error: string }).error, actions: [] }
      : {
          text: `Done. I commented on ${commentMatch[1].toUpperCase()}.`,
          actions: [outcome.action!],
        }
  }

  // "move CLW-12 to in progress"
  const moveMatch = text.match(
    /move\s+([a-z][a-z0-9]{1,5}-\d+)\s+(?:to|into)\s+(.+)/i
  )
  if (moveMatch) {
    const key = moveMatch[1].toUpperCase()
    const wanted = moveMatch[2]
      .replace(/[.!?]+$/, "")
      .trim()
      .toLowerCase()
    const target = ctx.store
      .categoriesOf(key.split("-")[0])
      .find(
        (c) =>
          c.name.toLowerCase() === wanted ||
          c.slug === wanted.replace(/\s+/g, "_")
      )
    if (!target) {
      const names = ctx.store
        .categoriesOf(key.split("-")[0])
        .map((c) => c.name)
        .join(", ")
      return {
        text: `I couldn't find a column called "${moveMatch[2]}". The columns are ${names}.`,
        actions: [],
      }
    }
    const outcome = await runTool(
      "move_ticket",
      { ticket_key: key, status: target.slug },
      ctx
    )
    if (outcome.isError)
      return { text: (outcome.result as { error: string }).error, actions: [] }
    if (!outcome.action)
      return {
        text: `${key} is already in the ${target.name} column.`,
        actions: [],
      }
    return {
      text: `Done. I moved ${key} to ${target.name}.`,
      actions: [outcome.action],
    }
  }

  // "create a ticket to fix the login page" / "new ticket: ..."
  const createMatch = text.match(
    /(?:create|add|make|open|new)\s+(?:a\s+|an\s+)?(?:new\s+)?ticket\s*(?:to|for|about|:|-)?\s*(.+)/i
  )
  if (createMatch && createMatch[1].trim()) {
    const raw = createMatch[1].replace(/[.!?]+$/, "").trim()
    const title = raw.charAt(0).toUpperCase() + raw.slice(1)
    const outcome = await runTool(
      "create_ticket",
      { project_key: project, title, status: categories[0].slug, tags: [] },
      ctx
    )
    if (outcome.isError)
      return { text: (outcome.result as { error: string }).error, actions: [] }
    const created = (outcome.result as { created: string }).created
    return {
      text: `Created ${created} in ${categories[0].name}. It's marked as made by me, acting for you.`,
      actions: [outcome.action!],
    }
  }

  // "what's waiting on me?"
  if (
    /waiting|pending|review|need.*(me|approval)|my (tickets|approvals)/.test(
      lower
    )
  ) {
    const waiting = tickets.filter((t) => t.status.trim().toLowerCase().replace(/[\s-]+/g, "_") === TICKET_STATUS.IN_REVIEW)
    if (waiting.length === 0)
      return { text: "Nothing is waiting on you right now.", actions: [] }
    const list = waiting.map((t) => `${t.key} (${t.title})`).join(", ")
    return {
      text: `${waiting.length} ${waiting.length === 1 ? "ticket is" : "tickets are"} waiting for your review: ${list}.`,
      actions: waiting.map((t) => ({
        label: `Open ${t.key}`,
        ticketKey: t.key,
      })),
    }
  }

  // "summarize CLW-16" / any message with a ticket id
  if (ticketKey) {
    const outcome = await runTool("get_ticket", { ticket_key: ticketKey }, ctx)
    if (outcome.isError)
      return { text: (outcome.result as { error: string }).error, actions: [] }
    const t = outcome.result as {
      title: string
      column: string
      tags: string[]
      created_by: { type: string }
      linked_commits: unknown[]
      comments: { body: string }[]
    }
    const parts = [
      `${ticketKey} "${t.title}" (column: ${t.column}).`,
      t.created_by.type === ACTOR_TYPES.AGENT
        ? "An agent made it."
        : "A person made it.",
      t.linked_commits.length
        ? `${t.linked_commits.length} linked commit(s).`
        : "",
      t.comments.length ? `Latest comment: "${t.comments.at(-1)!.body}"` : "",
    ]
    return {
      text: parts.filter(Boolean).join(" "),
      actions: [{ label: `Open ${ticketKey}`, ticketKey }],
    }
  }

  // "how is the board doing?"
  if (/board|status|overview|summar|how.*(going|doing)|progress/.test(lower)) {
    const mine = tickets.filter((t) => t.key.startsWith(`${project}-`))
    const counts = categories
      .map(
        (c) =>
          `${mine.filter((t) => t.status === c.slug).length} ${categoryName(c.slug, categories)}`
      )
      .join(", ")
    const agents = mine.filter(
      (t) => t.created_by.type === ACTOR_TYPES.AGENT
    ).length
    return {
      text: `${project} has ${mine.length} tickets: ${counts}. Agents made ${agents} of them.`,
      actions: [],
    }
  }

  if (/^(hi|hey|hello|help|\?)/.test(lower)) {
    return {
      text: `Hi! I'm Nutty, your NutShell assistant. I can look things up and make changes for you. Try: ${EXAMPLES.slice(0, 4).join(" · ")}`,
      actions: [],
    }
  }

  return {
    text: `I can help with a few requests from this board. Try: ${EXAMPLES.join(" · ")}`,
    actions: [],
  }
}

export const ASSISTANT_SUGGESTIONS = EXAMPLES.slice(0, 4)
