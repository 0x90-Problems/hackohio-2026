// Token scopes grouped by the part of NutShell they open, so a long list can be
// summed up as "13 scopes" or "Tickets, Chat, Folders" and expanded on demand.
// lib/scope-groups.test.mjs runs it with plain node, mapping @/shared to ../shared.

import { SCOPES, type Scope } from "@/shared/names"

export const SCOPE_AREAS = [
  "Tickets",
  "Activity",
  "Rules",
  "Folders",
  "Files",
  "Whiteboard",
  "Chat",
] as const
export type ScopeArea = (typeof SCOPE_AREAS)[number]

// Every scope in shared/names.ts must have an area: a new one fails the typecheck here.
const AREA_OF: Record<Scope, ScopeArea> = {
  [SCOPES.TICKETS_READ]: "Tickets",
  [SCOPES.TICKETS_WRITE]: "Tickets",
  [SCOPES.COMMENTS_WRITE]: "Tickets",
  [SCOPES.TICKETS_CLOSE]: "Tickets",
  [SCOPES.EVENTS_READ]: "Activity",
  [SCOPES.RULES_READ]: "Rules",
  [SCOPES.RULES_WRITE]: "Rules",
  [SCOPES.RULES_RUN]: "Rules",
  [SCOPES.FOLDERS_READ]: "Folders",
  [SCOPES.FOLDERS_WRITE]: "Folders",
  [SCOPES.FOLDERS_DELETE]: "Folders",
  [SCOPES.FOLDERS_SHARE]: "Folders",
  [SCOPES.FILES_READ]: "Files",
  [SCOPES.FILES_WRITE]: "Files",
  [SCOPES.WHITEBOARD_READ]: "Whiteboard",
  [SCOPES.WHITEBOARD_WRITE]: "Whiteboard",
  [SCOPES.WHITEBOARD_VIEW]: "Whiteboard",
  [SCOPES.CHAT_READ]: "Chat",
  [SCOPES.CHAT_WRITE]: "Chat",
  [SCOPES.CHAT_MANAGE]: "Chat",
  [SCOPES.CHAT_DM]: "Chat",
}

// A scope the board knows but this build doesn't yet still gets listed.
export const OTHER_AREA = "Other" as const

export type ScopeGroup = { area: ScopeArea | typeof OTHER_AREA; scopes: Scope[] }

export function scopeArea(scope: Scope): ScopeArea | typeof OTHER_AREA {
  return AREA_OF[scope] ?? OTHER_AREA
}

/** Scopes grouped by area, areas in a fixed order, scopes in their given order. Duplicates dropped. */
export function groupScopes(scopes: readonly Scope[]): ScopeGroup[] {
  const byArea = new Map<ScopeGroup["area"], Scope[]>()
  for (const scope of new Set(scopes)) {
    const area = scopeArea(scope)
    byArea.set(area, [...(byArea.get(area) ?? []), scope])
  }
  const order: ScopeGroup["area"][] = [...SCOPE_AREAS, OTHER_AREA]
  return order
    .filter((area) => byArea.has(area))
    .map((area) => ({ area, scopes: byArea.get(area)! }))
}

/** "No scopes", "1 scope", "13 scopes". */
export function scopeCountLabel(count: number): string {
  if (count === 0) return "No scopes"
  return `${count} ${count === 1 ? "scope" : "scopes"}`
}

/** The short version: a count and the areas it covers, e.g. "Tickets, Folders, Chat". */
export function scopeSummary(scopes: readonly Scope[]): { count: string; areas: string } {
  const groups = groupScopes(scopes)
  const total = groups.reduce((sum, group) => sum + group.scopes.length, 0)
  return { count: scopeCountLabel(total), areas: groups.map((group) => group.area).join(", ") }
}
