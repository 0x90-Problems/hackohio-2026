"use client"

import { ACTOR_TYPES } from "@/shared/names"
import { useAuthUser } from "@/components/auth/auth-gate"
import { useOpenProfile } from "@/components/profile/profile-dialog"
import { BotIcon } from "@/components/icons"
import { visibleAgentName } from "@/lib/agent-label"
import type { Actor, Ticket } from "@/lib/types"
import { getAgent, getUser } from "@/lib/mock-data"
import { useBoardDirectory } from "@/lib/use-board-directory"
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
        "rounded-sm border-dashed border-muted-foreground/60 bg-muted px-1.5 font-mono text-xs tracking-wide text-muted-foreground",
        className
      )}
    >
      <BotIcon className="size-3" aria-hidden="true" />
      AGENT
    </Badge>
  )
}

// A person's name that opens their profile. Plain text inside a link.
function PersonName({
  userId,
  interactive,
  children,
}: {
  userId: string
  interactive: boolean
  children: React.ReactNode
}) {
  const openProfile = useOpenProfile()
  if (!interactive || !openProfile) return <>{children}</>
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        openProfile(userId)
      }}
      className="inline-flex min-w-0 items-center gap-1.5 rounded-sm text-left hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      {children}
    </button>
  )
}

// Shows who did something. Humans: avatar + name.
// Agents: AGENT tag + agent name + "for [owner]".
// Clicking a person opens their profile, unless interactive is false.
export function ActorBadge({
  actor,
  className,
  wrap = false,
  interactive = true,
}: {
  actor: Actor
  className?: string
  wrap?: boolean
  interactive?: boolean
}) {
  const account = useAuthUser()
  const { people, agents } = useBoardDirectory()
  if (actor.type === ACTOR_TYPES.AGENT) {
    const record = agents.find((agent) => agent._id === actor.id)
    const agentName = visibleAgentName(
      actor.name,
      actor.id,
      record?.name || getAgent(actor.id)?.name
    )
    const ownerName =
      (actor.acting_for === account?._id ? account.name : undefined) ||
      people.find((person) => person._id === actor.acting_for)?.name ||
      getUser(actor.acting_for)?.name ||
      "Unknown owner"
    return (
      <span
        className={cn(
          "inline-flex min-w-0 items-center gap-1.5 text-sm",
          wrap && "max-w-full flex-wrap",
          className
        )}
      >
        <AgentTag className="shrink-0" />
        <span className={wrap ? "min-w-0 wrap-anywhere" : "truncate"}>
          {agentName}
          <span className="text-muted-foreground">
            {" "}
            · for{" "}
            <PersonName userId={actor.acting_for} interactive={interactive}>
              {ownerName}
            </PersonName>
          </span>
        </span>
      </span>
    )
  }

  const name =
    actor.name ||
    (actor.id === account?._id ? account.name : undefined) ||
    people.find((person) => person._id === actor.id)?.name ||
    getUser(actor.id)?.name ||
    (actor.id.startsWith("user_") ? actor.id.slice("user_".length) : undefined) ||
    "Unknown"
  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 text-sm",
        wrap && "max-w-full",
        className
      )}
    >
      <PersonName userId={actor.id} interactive={interactive}>
        <HumanAvatar name={name} className="shrink-0" />
        <span className={wrap ? "min-w-0 break-words" : "truncate"}>{name}</span>
      </PersonName>
    </span>
  )
}

// First word of the display name, without the agent tag or "for owner" line.
export function useShortActorName(actor: Actor): string {
  const account = useAuthUser()
  const { people, agents } = useBoardDirectory()
  const full =
    actor.type === ACTOR_TYPES.AGENT
      ? visibleAgentName(
          actor.name,
          actor.id,
          agents.find((agent) => agent._id === actor.id)?.name || getAgent(actor.id)?.name
        )
      : actor.name ||
        (actor.id === account?._id ? account.name : undefined) ||
        people.find((person) => person._id === actor.id)?.name ||
        getUser(actor.id)?.name ||
        (actor.id.startsWith("user_") ? actor.id.slice("user_".length) : undefined) ||
        "Unknown"
  return full.trim().split(/\s+/)[0] || "Someone"
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
