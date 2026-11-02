// Bringing a version saved outside the live editor (an agent's update_note, a restore)
// into a document that is open live. The live copy is what people see, so without this
// that version would stay invisible and the next autosave would bury it.

type SavedVersion = { version: number; created_by?: { type?: string }; restored_from?: number }

const outsideEditor = (v: SavedVersion) => v.created_by?.type === "agent" || v.restored_from != null

/**
 * Which saved versions the live copy is missing. `applied` is the newest version it is
 * known to include. Returns the version to bring in and the one it was based on, or null
 * when the newest version came from the editor itself.
 */
export function missingVersions(versions: SavedVersion[], applied: number): { base: number; latest: number } | null {
  const newestFirst = [...versions].sort((a, b) => b.version - a.version)
  const latest = newestFirst[0]
  if (!latest || latest.version <= applied || !outsideEditor(latest)) return null
  let base = latest.version
  for (const v of newestFirst) {
    base = v.version
    if (v.version <= applied || !outsideEditor(v)) break
  }
  return base === latest.version ? null : { base, latest: latest.version }
}

/** The part of `base` that `changed` rewrites, in lines: [start, end) in base, plus the new lines. */
function changedRegion(base: string[], changed: string[]) {
  let start = 0
  while (start < base.length && start < changed.length && base[start] === changed[start]) start++
  let tail = 0
  while (tail < base.length - start && tail < changed.length - start && base[base.length - 1 - tail] === changed[changed.length - 1 - tail]) tail++
  return { start, end: base.length - tail, lines: changed.slice(start, changed.length - tail) }
}

/**
 * Three-way merge by lines. Returns the merged text, or null when both sides changed the
 * same part, which needs a person. At least one unchanged line must separate the two edits.
 */
export function mergeLines(base: string, ours: string, theirs: string): string | null {
  if (ours === base || ours === theirs) return theirs
  if (theirs === base) return ours
  const lines = base.split("\n")
  const mine = changedRegion(lines, ours.split("\n"))
  const other = changedRegion(lines, theirs.split("\n"))
  const [first, second] = mine.start <= other.start ? [mine, other] : [other, mine]
  if (first.end >= second.start) return null
  return [...lines.slice(0, first.start), ...first.lines, ...lines.slice(first.end, second.start), ...second.lines, ...lines.slice(second.end)].join("\n")
}
