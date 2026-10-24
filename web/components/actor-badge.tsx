import { ACTOR_TYPES } from "@/shared/names"
import type { Actor } from "@/lib/types"
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
  if (actor.type === ACTOR_TYPES.AGENT) {
    const agentName = getAgent(actor.id)?.name ?? actor.id
    const ownerName = getUser(actor.acting_for)?.name ?? actor.acting_for
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

  const name = getUser(actor.id)?.name ?? actor.id
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5 text-sm", className)}>
      <HumanAvatar name={name} />
      <span className="truncate">{name}</span>
    </span>
  )
}
