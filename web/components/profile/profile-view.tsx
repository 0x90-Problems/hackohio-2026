"use client"

import { useMemo } from "react"

import { ACTOR_TYPES, AGENT_CONNECTION } from "@/shared/names"
import type { Agent, Event } from "@/lib/types"
import { describeEvent, eventId, timeAgo } from "@/lib/format"
import {
  activityWeeks,
  agentsOf,
  findUser,
  heatLevel,
  splitActivity,
  type DayCell,
} from "@/lib/profile"
import { getAgent } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import { useAuthUser } from "@/components/auth/auth-gate"
import { useProjects } from "@/components/projects/projects-store"
import { AgentTag, HumanAvatar } from "@/components/actor-badge"
import { EmptyState } from "@/components/illustrations"
import { ScopeBadge } from "@/components/scope-badge"
import { Badge } from "@/components/ui/badge"

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]
const DAYS = ["", "Mon", "", "Wed", "", "Fri", ""]

// A person's profile: who they are, how active they and their agents have
// been, and what they did lately. `compact` is the version in the popup.
export function ProfileView({
  userId,
  compact = false,
}: {
  userId: string
  compact?: boolean
}) {
  const account = useAuthUser()
  const { activity, tickets, comments } = useProjects()
  const user = findUser(userId, account)
  const agents = agentsOf(userId)
  // The same event can arrive twice (saved locally and in MongoDB): count it once
  const { own, byAgents } = useMemo(() => {
    const seen = new Set<string>()
    const unique = activity.filter((e) => {
      const id = eventId(e)
      if (seen.has(id)) return false
      seen.add(id)
      return true
    })
    return splitActivity(userId, unique)
  }, [userId, activity])

  if (!user) {
    return (
      <EmptyState
        title="We couldn't find this person"
        hint="They may have left the team."
      />
    )
  }

  const ticketsOwned = tickets.filter((t) =>
    t.owner_id
      ? t.owner_id === userId
      : t.created_by.type === ACTOR_TYPES.HUMAN
        ? t.created_by.id === userId
        : t.created_by.acting_for === userId
  ).length
  const commentCount = comments.filter(
    (c) =>
      (c.author.type === ACTOR_TYPES.HUMAN && c.author.id === userId) ||
      (c.author.type === ACTOR_TYPES.AGENT && c.author.acting_for === userId)
  ).length
  const isYou = account?._id === userId

  return (
    <div className="flex flex-col gap-6">
      {/* Who they are */}
      <header className="flex items-center gap-4">
        <HumanAvatar name={user.name} size="lg" className="size-16 text-xl" />
        <div className="min-w-0">
          <h1
            className={cn(
              "font-heading font-bold tracking-tight",
              compact ? "text-xl" : "text-3xl"
            )}
          >
            {user.name}
            {isYou && (
              <span className="ml-2 align-middle text-sm font-normal text-muted-foreground">
                (you)
              </span>
            )}
          </h1>
          <p className="truncate text-sm text-muted-foreground">
            @{user.auth_username} · {user.team}
          </p>
          {user.role && <p className="mt-0.5 text-sm">{user.role}</p>}
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Their actions" value={own.length} />
        <Stat label="By their agents" value={byAgents.length} />
        <Stat label="Tickets owned" value={ticketsOwned} />
        <Stat label="Comments" value={commentCount} />
      </dl>

      <section className="flex flex-col gap-2">
        <SectionTitle>Activity</SectionTitle>
        <ActivityGraph
          own={own}
          byAgents={byAgents}
          weeks={compact ? 14 : 22}
        />
      </section>

      <div className={cn("grid gap-6", !compact && "lg:grid-cols-2")}>
        <section className="flex flex-col gap-2">
          <SectionTitle>
            Agents acting for {isYou ? "you" : user.name}
          </SectionTitle>
          <AgentTree ownerName={user.name} agents={agents} events={byAgents} />
        </section>
        <section className="flex flex-col gap-2">
          <SectionTitle>Recent activity</SectionTitle>
          <ActivityTimeline
            events={[...own, ...byAgents]}
            limit={compact ? 5 : 12}
          />
        </section>
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
      {children}
    </h2>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

// GitHub-style grid: one square per day, darker red means busier
export function ActivityGraph({
  own,
  byAgents,
  weeks,
}: {
  own: Event[]
  byAgents: Event[]
  weeks: number
}) {
  const columns = useMemo(
    () => activityWeeks(own, byAgents, weeks),
    [own, byAgents, weeks]
  )
  const max = Math.max(0, ...columns.flat().map((c) => c.own + c.agents))
  const today = new Date()

  // Like GitHub: a month's label sits above the week holding its 1st day
  const monthLabels = columns.map((col) => {
    const first = col.find((c) => c.date.getDate() === 1)
    return first ? MONTHS[first.date.getMonth()] : ""
  })

  return (
    <div className="overflow-x-auto rounded-xl border bg-card p-3">
      <div className="inline-flex gap-2">
        <div className="mt-4 grid grid-rows-7 gap-[3px] text-[10px] leading-[11px] text-muted-foreground">
          {DAYS.map((d, i) => (
            <span key={i} className="h-[11px]">
              {d}
            </span>
          ))}
        </div>
        <div>
          <div className="flex gap-[3px] text-[10px] leading-4 text-muted-foreground">
            {monthLabels.map((m, i) => (
              <span
                key={i}
                className="w-[11px] overflow-visible whitespace-nowrap"
              >
                {m}
              </span>
            ))}
          </div>
          <div className="flex gap-[3px]">
            {columns.map((col, i) => (
              <div key={i} className="grid grid-rows-7 gap-[3px]">
                {col.map((cell) => (
                  <HeatCell
                    key={cell.date.toISOString()}
                    cell={cell}
                    max={max}
                    future={cell.date > today}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
        Less
        {[0, 1, 2, 3, 4].map((l) => (
          <span
            key={l}
            className="size-[11px] rounded-[3px]"
            style={{ background: `var(--heat-${l})` }}
          />
        ))}
        More
      </div>
    </div>
  )
}

function HeatCell({
  cell,
  max,
  future,
}: {
  cell: DayCell
  max: number
  future: boolean
}) {
  const total = cell.own + cell.agents
  const day = cell.date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
  const label =
    total === 0
      ? `No activity on ${day}`
      : `${total} on ${day}: ${cell.own} by them, ${cell.agents} by their agents`
  return (
    <span
      title={label}
      aria-label={label}
      className={cn("size-[11px] rounded-[3px]", future && "opacity-0")}
      style={{ background: `var(--heat-${heatLevel(total, max)})` }}
    />
  )
}

// The person at the root, each of their agents as a branch
function AgentTree({
  ownerName,
  agents,
  events,
}: {
  ownerName: string
  agents: Agent[]
  events: Event[]
}) {
  if (agents.length === 0) {
    return (
      <EmptyState
        title="No agents yet"
        hint="Agents connected on the Agents page show up here."
        className="py-2"
      />
    )
  }
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <HumanAvatar name={ownerName} />
        {ownerName}
      </div>
      <ul className="mt-1 ml-3 border-l border-dashed border-muted-foreground/40">
        {agents.map((agent) => {
          const mine = events.filter((e) => e.actor.id === agent._id)
          const last = mine.reduce<Date | null>(
            (latest, e) =>
              !latest || e.created_at > latest ? e.created_at : latest,
            null
          )
          return (
            <li key={agent._id} className="relative py-2 pl-5">
              <span className="absolute top-[1.15rem] left-0 w-4 border-t border-dashed border-muted-foreground/40" />
              <div className="flex flex-wrap items-center gap-1.5 text-sm">
                <AgentTag />
                <span className="font-medium">{agent.name}</span>
                <span className="text-xs text-muted-foreground">
                  {agent.connection === AGENT_CONNECTION.MCP
                    ? "via MCP"
                    : "via API key"}
                </span>
                {agent.revoked && <Badge variant="destructive">Revoked</Badge>}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {agent.scopes.map((s) => (
                  <ScopeBadge key={s} scope={s} className="text-[10px]" />
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {mine.length} {mine.length === 1 ? "action" : "actions"}
                {last && ` · last active ${timeAgo(last)}`}
              </p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// Newest first, as a line of dots: solid for the person, dashed for agents
function ActivityTimeline({
  events,
  limit,
}: {
  events: Event[]
  limit: number
}) {
  const { tickets } = useProjects()
  const recent = [...events]
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    .slice(0, limit)
  if (recent.length === 0) {
    return <EmptyState title="No activity yet" className="py-2" />
  }
  const boardTickets = tickets
  return (
    <ol className="relative ml-1.5 rounded-xl border-l pl-0">
      {recent.map((e, i) => {
        const byAgent = e.actor.type === ACTOR_TYPES.AGENT
        return (
          <li
            key={`${eventId(e)}-${i}`}
            className="relative pb-3 pl-5 last:pb-0"
          >
            <span
              className={cn(
                "absolute top-1.5 -left-[5px] size-2.5 rounded-full",
                byAgent
                  ? "border border-dashed border-muted-foreground bg-background"
                  : "bg-primary"
              )}
            />
            <p className="text-sm">
              {describeEvent(e, undefined, boardTickets)}
            </p>
            <p className="text-xs text-muted-foreground">
              {byAgent ? `${getAgent(e.actor.id)?.name ?? "An agent"} · ` : ""}
              {timeAgo(e.created_at)}
            </p>
          </li>
        )
      })}
    </ol>
  )
}
