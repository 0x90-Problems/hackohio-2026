// Where a suggestion from an agent (NSB-88) takes you, and the selection rules of the Suggestions
// card. Dependency-free so node --test can load it.

export type SuggestionTarget = { kind: "ticket" | "file" | "page"; ref: string }

/** The in-app address for what a suggestion points at; null when it points at nothing we can open. */
export function suggestionHref(target: SuggestionTarget | undefined): string | null {
  if (!target) return null
  const ref = target.ref.trim()
  if (target.kind === "ticket") {
    if (!/^[A-Z][A-Z0-9]{1,5}-\d{1,9}$/.test(ref)) return null
    const project = ref.split("-")[0]
    return `/projects/${encodeURIComponent(project)}/board/ticket/${encodeURIComponent(ref)}`
  }
  if (target.kind === "file") {
    if (/^nte_[0-9a-z]+$/.test(ref)) return `/docs/${encodeURIComponent(ref)}`
    if (/^wbd_[0-9a-z]+$/.test(ref)) return `/boards/${encodeURIComponent(ref)}`
    if (/^fld_[0-9a-z]+$/.test(ref)) return `/files?folder=${encodeURIComponent(ref)}`
    if (/^fil_[0-9a-z]+$/.test(ref)) return `/api/files/${encodeURIComponent(ref)}/view`
    return null
  }
  // The board only accepts in-app pages; check again here before using it as a link.
  if (!ref.startsWith("/") || ref.startsWith("//") || ref.includes("\\") || /[\u0000-\u001f\u007f]/.test(ref)) return null
  return ref
}

/** The words on the open button for a target. */
export function suggestionLinkLabel(target: SuggestionTarget | undefined): string {
  if (!target) return "Open"
  if (target.kind === "ticket") return `Open ${target.ref}`
  if (target.kind === "file") {
    if (target.ref.startsWith("nte_")) return "Open the note"
    if (target.ref.startsWith("wbd_")) return "Open the whiteboard"
    if (target.ref.startsWith("fld_")) return "Open the folder"
    return "Open the file"
  }
  return "Open the page"
}

/** Ticks one row on or off. */
export function toggleId(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

/** "Select all" ticks every row, or clears them when all are already ticked. */
export function toggleAll(selected: ReadonlySet<string>, ids: readonly string[]): Set<string> {
  return ids.length > 0 && ids.every((id) => selected.has(id)) ? new Set() : new Set(ids)
}

/** Drops ticks for rows that are gone (dismissed elsewhere, or by another tab). */
export function keepPresent(selected: ReadonlySet<string>, ids: readonly string[]): Set<string> {
  const present = new Set(ids)
  return new Set([...selected].filter((id) => present.has(id)))
}
