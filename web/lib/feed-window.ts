// Long feeds (Live activity) show the newest rows first and add more as you scroll, instead of
// drawing every event at once.

export const FEED_PAGE = 30

/** How many rows to show after reaching the end of what's shown. */
export function moreRows(shown: number, total: number, page = FEED_PAGE): number {
  return Math.min(total, Math.max(shown, 0) + page)
}

/**
 * Keeps the reader's place when new events arrive at the top: rows shown so far stay shown, so
 * the bottom of the list doesn't shrink under them.
 */
export function rowsAfterNew(shown: number, before: number, after: number, page = FEED_PAGE): number {
  // Nothing was shown yet (the events just loaded): start at one page, not at everything.
  if (before === 0 || shown === 0) return Math.min(page, after)
  const added = Math.max(after - before, 0)
  return Math.min(after, Math.max(shown + added, Math.min(page, after)))
}
