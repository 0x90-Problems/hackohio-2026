"use client"

import { useState } from "react"
import { toast } from "sonner"

import type { Category, Ticket } from "@/lib/types"
import { approvalRole, cleanReason, MAX_SEND_BACK_REASON } from "@/lib/approval"
import { categoryName } from "@/lib/categories"
import { absoluteTime, timeAgo } from "@/lib/format"
import { useAuthUser } from "@/components/auth/auth-gate"
import { useProjects } from "@/components/projects/projects-store"
import { ActorBadge } from "@/components/actor-badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

// A close that waits for approval, and who approved the last one. Lives in the ticket's header.
export function ApprovalPanel({
  ticket,
  categories,
  reviewerName,
}: {
  ticket: Ticket
  categories: Category[]
  reviewerName?: string
}) {
  const account = useAuthUser()
  const { approveClose, sendBackClose } = useProjects()
  const [busy, setBusy] = useState(false)
  const [sendingBack, setSendingBack] = useState(false)
  const [reason, setReason] = useState("")
  const request = ticket.approval_request

  async function run(action: () => Promise<void>, failure: string) {
    setBusy(true)
    try {
      await action()
      setSendingBack(false)
      setReason("")
    } catch (error) {
      toast.error(failure, { description: error instanceof Error ? error.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  if (!request) {
    // The board clears approved_by when the ticket leaves done, so this only shows on closed tickets.
    if (!ticket.approved_by) return null
    return (
      <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        Close approved by
        <ActorBadge actor={ticket.approved_by} className="text-foreground" />
        {ticket.approved_at && <span title={absoluteTime(ticket.approved_at)}>· {timeAgo(ticket.approved_at)} ago</span>}
      </p>
    )
  }

  const role = account ? approvalRole(ticket, { id: account._id, admin: account.admin === true }) : null
  const target = categoryName(request.to, categories)

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed bg-muted/40 p-3 duration-200 animate-in fade-in">
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <span className="font-medium">Waiting for approval.</span>
        <ActorBadge actor={request.by} />
        <span className="text-muted-foreground">
          asked to move this to {target} <span title={absoluteTime(request.at)}>· {timeAgo(request.at)} ago</span>
        </span>
      </div>

      {role === "answer" && !sendingBack && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={busy} onClick={() => run(() => approveClose(ticket.key), `Couldn't approve ${ticket.key}`)}>
            Approve
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setSendingBack(true)}>
            Send back
          </Button>
        </div>
      )}

      {role === "answer" && sendingBack && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void run(() => sendBackClose(ticket.key, cleanReason(reason)), `Couldn't send ${ticket.key} back`)
          }}
        >
          <Label htmlFor={`send-back-${ticket.key}`}>Why? (optional)</Label>
          <Textarea
            id={`send-back-${ticket.key}`}
            className="min-h-16 resize-y"
            value={reason}
            maxLength={MAX_SEND_BACK_REASON}
            onChange={(event) => setReason(event.target.value)}
            placeholder="What still needs doing…"
            autoFocus
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" type="submit" disabled={busy}>
              Send back
            </Button>
            <Button size="sm" variant="ghost" type="button" disabled={busy} onClick={() => setSendingBack(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {role === "withdraw" && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Someone else on the project approves it.</span>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => sendBackClose(ticket.key, ""), `Couldn't withdraw ${ticket.key}`)}>
            Withdraw
          </Button>
        </div>
      )}

      {role === "wait" && (
        <p className="text-sm text-muted-foreground">
          {reviewerName ? `${reviewerName} approves this one, as its reviewer.` : "The ticket's reviewer approves this one."}
        </p>
      )}
    </div>
  )
}
