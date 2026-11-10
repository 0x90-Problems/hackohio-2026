// Moving several folder items at once: picking a range, checking a drop target, running the
// moves and summing them up in one message. The files API has no batch move, so each item is
// its own PATCH; the API still checks every one (role, cycles, rev).
//
// Dependency-free (type-only imports) so node --test can load it.

/** The drag type for items dragged within Folders. Files dragged in from the computer carry "Files" instead. */
export const NODE_DRAG_TYPE = "application/x-nutshell-nodes"

/** How many moves run at once. */
export const MOVE_CONCURRENCY = 3

type Moving = { id: string; type: string; parent: string }
export type DropTarget = { id: string; name: string; ancestors: string[] }

/** Ids from the anchor to id, inclusive, in list order (a shift-click). Just id when there's no anchor in the list. */
export function rangeIds(order: string[], anchor: string | null, id: string): string[] {
  const from = anchor === null ? -1 : order.indexOf(anchor)
  const to = order.indexOf(id)
  if (from === -1 || to === -1) return [id]
  const [start, end] = from < to ? [from, to] : [to, from]
  return order.slice(start, end + 1)
}

/**
 * Whether these items can be dropped into target, and which of them would actually move. A folder
 * can't go into itself or anything under it; items already in the target are left out.
 */
export function dropCheck<T extends Moving>(moving: T[], target: DropTarget): { ok: true; nodes: T[] } | { ok: false; reason: string } {
  const inside = new Set([target.id, ...target.ancestors])
  if (moving.some((node) => node.type === "folder" && inside.has(node.id))) {
    return { ok: false, reason: "A folder can't go inside itself." }
  }
  const nodes = moving.filter((node) => node.parent !== target.id)
  if (nodes.length === 0) return { ok: false, reason: `Already in ${target.name}.` }
  return { ok: true, nodes }
}

export type Settled<R> = { ok: true; value: R } | { ok: false; error: unknown }

/** Run work over items, at most limit at a time. Results keep the items' order; one failure doesn't stop the rest. */
export async function settleLimited<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>): Promise<Settled<R>[]> {
  const results: Settled<R>[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next++
      try {
        results[index] = { ok: true, value: await work(items[index]) }
      } catch (error) {
        results[index] = { ok: false, error }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, worker))
  return results
}

/** One toast for a batch of moves: "Moved 5 items to Docs", or "Moved 4 of 5 to Docs" with why the rest didn't. */
export function moveSummary(names: string[], failures: { name: string; reason: string }[], label: string): { ok: boolean; title: string; description?: string } {
  const total = names.length
  const moved = total - failures.length
  const what = total === 1 ? names[0] : `${total} items`
  if (failures.length === 0) return { ok: true, title: `Moved ${what} to ${label}` }
  const reasons = [...new Set(failures.map((failure) => failure.reason))]
  // One reason for all of them reads better without the names.
  const why =
    reasons.length === 1
      ? reasons[0]
      : failures
          .slice(0, 3)
          .map((failure) => `${failure.name}: ${failure.reason}`)
          .join("; ") + (failures.length > 3 ? `; and ${failures.length - 3} more` : "")
  if (moved === 0) return { ok: false, title: `Couldn't move ${what}`, description: why }
  return { ok: false, title: `Moved ${moved} of ${total} to ${label}`, description: `${failures.length} couldn't move: ${why}` }
}
