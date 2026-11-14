// Approval before close: what the signed-in person can do with a close that waits for approval.
// The same rules as the board API (approveTicket / sendBackTicket in the backend). The board
// still decides, so this only avoids offering what it would refuse.

import type { Ticket } from "@/lib/types"

type Viewer = { id: string; admin: boolean }

/**
 * "answer": may approve or send it back. "withdraw": they asked, so someone else approves.
 * "wait": a reviewer is set and it isn't them. null: nothing is waiting.
 */
export function approvalRole(ticket: Pick<Ticket, "approval_request" | "reviewer_id">, viewer: Viewer) {
  const request = ticket.approval_request
  if (!request) return null
  if (request.by.id === viewer.id) return "withdraw" as const
  if (ticket.reviewer_id && ticket.reviewer_id !== viewer.id && !viewer.admin) return "wait" as const
  return "answer" as const
}

/** Closes waiting on this person, newest request first. */
export function approvalsWaitingOn<T extends Pick<Ticket, "approval_request" | "reviewer_id">>(tickets: readonly T[], viewer: Viewer): T[] {
  return tickets
    .filter((ticket) => approvalRole(ticket, viewer) === "answer")
    .sort((a, b) => (b.approval_request?.at.getTime() ?? 0) - (a.approval_request?.at.getTime() ?? 0))
}

/** A send-back reason: trimmed, at most 1000 characters (the board refuses longer). */
export const MAX_SEND_BACK_REASON = 1000
export function cleanReason(raw: string): string {
  return raw.trim().slice(0, MAX_SEND_BACK_REASON)
}
