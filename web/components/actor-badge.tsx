"use client"

import { ACTOR_TYPES } from "@/shared/names"
import { useAuthUser } from "@/components/auth/auth-gate"
import { BotIcon } from "@/components/icons"
import type { Actor, Ticket } from "@/lib/types"
import { getAgent, getUser } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

export function initials(name: string) {
  return name.slice(0, 2).toUpperCase()
}

// A solid circle with initials. Only humans get one.
export function HumanAvatar({
  name,
  size = "sm",
  className,
}: {
  name: string
  size?: "sm" | "default" | "lg"
  className?: string
}) {
  return (
    <Avatar size={size} className={className}>
      <AvatarFallback className="bg-foreground font-semibold text-background">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  )
}

// The dashed gray "AGENT" tag. Only agents get one.
export function AgentTag({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-sm border-dashed border-muted-foreground/60 bg-muted px-1.5 font-mono text-[10px] tracking-wide text-muted-foreground",
        className
      )}
    >
      <BotIcon className="size-3" aria-hidden="true" />
      AGENT
    </Badge>
  )
}

// Shows who did something. Humans: avatar + name.
// Agents: AGENT tag + agent name + "for [owner]".
export function ActorBadge({
  actor,
  className,
}: {
  actor: Actor
  className?: string
}) {
  const account = useAuthUser()
  if (actor.type === ACTOR_TYPES.AGENT) {
    const agentName = getAgent(actor.id)?.name ?? actor.id
    const ownerName =
      actor.acting_for === account?._id
        ? account.name
        : (getUser(actor.acting_for)?.name ?? actor.acting_for)
    return (
      <span
        className={cn("inline-flex min-w-0 items-center gap-1.5 text-sm", className)}
      >
        <AgentTag />
        <span className="truncate">
          {agentName}
          <span className="text-muted-foreground"> · for {ownerName}</span>
        </span>
      </span>
    )
  }

  const name = actor.id === account?._id ? account.name : (getUser(actor.id)?.name ?? actor.id)
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5 text-sm", className)}>
      <HumanAvatar name={name} />
      <span className="truncate">{name}</span>
    </span>
  )
}

export function TicketOwnerBadge({ ticket }: { ticket: Ticket }) {
  const ownerId =
    ticket.owner_id ??
    (ticket.created_by.type === ACTOR_TYPES.AGENT
      ? ticket.created_by.acting_for
      : ticket.created_by.id)
  const account = useAuthUser()
  const owner = getUser(ownerId)
  const ownerName = ownerId === account?._id ? account.name : owner?.name

  return ownerName ? (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-sm">
      <HumanAvatar name={ownerName} />
      <span className="truncate">{ownerName}</span>
    </span>
  ) : (
    <span className="text-sm text-muted-foreground">Unassigned</span>
  )
}
