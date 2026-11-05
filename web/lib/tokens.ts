import { SCOPES, TOKEN_PREFIX, type Scope } from "@/shared/names"

// Where a scope is listed in the token wizards. Each area is one group of checkboxes.
export type ScopeAreaId = "tickets" | "files" | "whiteboards" | "chat"

export const SCOPE_AREAS: { id: ScopeAreaId; label: string }[] = [
  { id: "tickets", label: "Tickets" },
  { id: "files", label: "Folders and files" },
  { id: "whiteboards", label: "Whiteboards" },
  { id: "chat", label: "Chat" },
]

export type ScopeOption = {
  scope: Scope
  label: string
  area: ScopeAreaId
  /** Only reads. Read only picks these. */
  read?: boolean
  /** Never ticked by a preset: the person ticks it themselves. */
  optIn?: boolean
  /** Shown under this scope's own label, never between two scopes. */
  hint?: string
}

// Plain-English names for each scope, in the order shown. A hint shows under the label.
export const SCOPE_OPTIONS: ScopeOption[] = [
  { scope: SCOPES.TICKETS_READ, label: "Read tickets", area: "tickets", read: true },
  { scope: SCOPES.TICKETS_WRITE, label: "Create and move tickets", area: "tickets" },
  { scope: SCOPES.COMMENTS_WRITE, label: "Comment", area: "tickets" },
  { scope: SCOPES.TICKETS_CLOSE, label: "Close tickets", area: "tickets" },
  { scope: SCOPES.FOLDERS_READ, label: "Browse folders", area: "files", read: true },
  { scope: SCOPES.FOLDERS_WRITE, label: "Create, rename and move folders", area: "files" },
  { scope: SCOPES.FOLDERS_DELETE, label: "Move folders to the trash", area: "files" },
  { scope: SCOPES.FILES_READ, label: "Read files and documents", area: "files", read: true },
  { scope: SCOPES.FILES_WRITE, label: "Upload files and edit documents", area: "files" },
  { scope: SCOPES.WHITEBOARD_READ, label: "See whiteboards", area: "whiteboards", read: true },
  { scope: SCOPES.WHITEBOARD_WRITE, label: "Draw on whiteboards", area: "whiteboards" },
  {
    scope: SCOPES.WHITEBOARD_VIEW,
    label: "See whiteboard pictures",
    area: "whiteboards",
    read: true,
    optIn: true,
    // NSB-47: writing in a picture reaches the agent unfiltered, so this stays off unless ticked.
    hint: "Needs See whiteboards. Off by default: handwriting or text in a picture can hide instructions for your agent.",
  },
  { scope: SCOPES.CHAT_READ, label: "Read chat", area: "chat", read: true },
  { scope: SCOPES.CHAT_WRITE, label: "Post in chat", area: "chat" },
  // folders:share, chat:manage and chat:dm are never offered: they are people-only.
]

export type ScopePresetId = "read" | "tickets" | "everything"

/** Quick picks for the first wizard step. Opt-in scopes are never in a preset. */
export const SCOPE_PRESETS: { id: ScopePresetId; label: string; description: string; scopes: Scope[] }[] = [
  {
    id: "read",
    label: "Read only",
    description: "Look, never change anything.",
    scopes: SCOPE_OPTIONS.filter((o) => o.read && !o.optIn).map((o) => o.scope),
  },
  {
    id: "tickets",
    label: "Tickets",
    description: "Read, create, move and comment on tickets.",
    scopes: [SCOPES.TICKETS_READ, SCOPES.TICKETS_WRITE, SCOPES.COMMENTS_WRITE],
  },
  {
    id: "everything",
    label: "Everything",
    description: "Every scope except whiteboard pictures, which you tick yourself.",
    scopes: SCOPE_OPTIONS.filter((o) => !o.optIn).map((o) => o.scope),
  },
]

/** Scopes in the order the board lists them, without repeats or unknown ones. */
export function orderScopes(scopes: readonly Scope[]): Scope[] {
  return SCOPE_OPTIONS.map((o) => o.scope).filter((s) => scopes.includes(s))
}

/** The preset that is exactly this selection, if any. */
export function matchingPreset(scopes: readonly Scope[]): ScopePresetId | null {
  const chosen = orderScopes(scopes)
  const found = SCOPE_PRESETS.find(
    (p) => p.scopes.length === chosen.length && p.scopes.every((s) => chosen.includes(s))
  )
  return found?.id ?? null
}

/** Options grouped by area, in area order, each keeping its own hint. */
export function scopeGroups() {
  return SCOPE_AREAS.map((area) => ({
    ...area,
    options: SCOPE_OPTIONS.filter((o) => o.area === area.id),
  })).filter((group) => group.options.length > 0)
}

// Mock token/key. The real one will come from the backend, which stores only its hash.
export function makeToken(username: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  const random = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  const initials = username.replace(/[^a-z0-9]/gi, "").slice(0, 2).toLowerCase() || "xx"
  return `${TOKEN_PREFIX}${initials}_${random}`
}

// What's safe to show after creation: the prefix, then dots.
export const maskToken = (prefix: string) => `${prefix}••••••••`
