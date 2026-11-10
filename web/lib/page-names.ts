// Names for new document pages. Dependency-free so node --test can load it.

const UNTITLED = /^Untitled(?: (\d+))?$/i

/** "Untitled 1", "Untitled 2", …: one past the highest number already used among the siblings. */
export function nextUntitled(siblings: string[]): string {
  let highest = 0
  for (const name of siblings) {
    const match = UNTITLED.exec(name.trim())
    if (match) highest = Math.max(highest, match[1] ? Number(match[1]) : 1)
  }
  return `Untitled ${highest + 1}`
}

/** A page name as typed: trimmed and on one line. Empty means "keep the old name". */
export function cleanPageName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim()
}
