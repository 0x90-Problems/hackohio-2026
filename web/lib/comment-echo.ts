// A comment shows the moment it's posted (a local echo) and again when the board's own copy
// arrives on the next refresh. The two carry different clocks, so matching on the timestamp
// showed the comment twice until the page was reloaded.

import type { Comment } from "@/lib/types"

const WINDOW_MS = 5 * 60_000

const exactKey = (comment: Comment) => `${comment.ticket_key}:${comment.created_at.toISOString()}:${comment.body}`

/** The board's copy of a local echo: same ticket, author and text, within a few minutes. */
export function confirmsCommentEcho(local: Comment, server: Comment): boolean {
  return (
    local.ticket_key === server.ticket_key &&
    local.author.type === server.author.type &&
    local.author.id === server.author.id &&
    local.body.trim() === server.body.trim() &&
    Math.abs(local.created_at.getTime() - server.created_at.getTime()) <= WINDOW_MS
  )
}

/**
 * The board's comments merged into what's shown. Each new one replaces at most one local echo,
 * in place, so posting the same text twice still shows twice. Returns `current` when nothing changed.
 */
export function mergeServerComments(current: Comment[], remote: Comment[]): Comment[] {
  const known = new Set(current.map(exactKey))
  const fresh = remote.filter((comment) => !known.has(exactKey(comment)))
  if (fresh.length === 0) return current
  const next = current.map((comment) => {
    if (!comment.local) return comment
    const at = fresh.findIndex((server) => confirmsCommentEcho(comment, server))
    return at < 0 ? comment : fresh.splice(at, 1)[0]
  })
  return [...next, ...fresh]
}
