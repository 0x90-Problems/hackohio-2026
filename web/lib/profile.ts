// Profile numbers, built from the events the board already loads. A person's
// activity is what they did themselves plus what their agents did for them,
// kept apart so the profile can show both.
import { ACTOR_TYPES } from "@/shared/names"
import type { Agent, Event, User } from "@/lib/types"
import type { AuthUser } from "@/lib/board-auth"
import { agents as allAgents, getUser } from "@/lib/mock-data"

export type ProfileUser = Pick<
  User,
  "_id" | "auth_username" | "name" | "role" | "team"
>

// The signed-in account is the freshest copy of its own details
export function findUser(
  id: string,
  account: AuthUser | null
): ProfileUser | null {
  if (account && account._id === id) return account
  return getUser(id) ?? null
}

export const agentsOf = (userId: string): Agent[] =>
  allAgents.filter((a) => a.owner_id === userId)

export function splitActivity(userId: string, events: Event[]) {
  const own: Event[] = []
  const byAgents: Event[] = []
  for (const e of events) {
    if (e.actor.type === ACTOR_TYPES.HUMAN && e.actor.id === userId) own.push(e)
    else if (
      e.actor.type === ACTOR_TYPES.AGENT &&
      e.actor.acting_for === userId
    )
      byAgents.push(e)
  }
  return { own, byAgents }
}

export type DayCell = { date: Date; own: number; agents: number }

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

// Columns of 7 days (Sunday first), oldest week on the left, ending this week
export function activityWeeks(
  own: Event[],
  byAgents: Event[],
  weeks: number,
  now: Date = new Date()
): DayCell[][] {
  const counts = new Map<string, { own: number; agents: number }>()
  const bump = (e: Event, field: "own" | "agents") => {
    const key = dayKey(e.created_at)
    const c = counts.get(key) ?? { own: 0, agents: 0 }
    c[field]++
    counts.set(key, c)
  }
  own.forEach((e) => bump(e, "own"))
  byAgents.forEach((e) => bump(e, "agents"))

  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  start.setDate(start.getDate() - start.getDay() - (weeks - 1) * 7)
  const columns: DayCell[][] = []
  for (let w = 0; w < weeks; w++) {
    const column: DayCell[] = []
    for (let d = 0; d < 7; d++) {
      const date = new Date(start)
      date.setDate(start.getDate() + w * 7 + d)
      const c = counts.get(dayKey(date)) ?? { own: 0, agents: 0 }
      column.push({ date, ...c })
    }
    columns.push(column)
  }
  return columns
}

// 0 (none) to 4 (busiest), relative to this person's busiest day
export function heatLevel(total: number, max: number) {
  if (total === 0 || max === 0) return 0
  return Math.min(4, Math.ceil((total / max) * 4))
}
