// Which browser in a live document saves versions and checks for edits made outside the
// editor. Only one should, or the same change gets applied twice. Browsers say whether they
// can edit in their awareness state (`can_edit`), because one that can't never saves.
//
// That state comes from the browser, so it decides nothing about access: the relay and the
// files API check every write. A false claim can only pause autosave while that browser is
// here, and pressing Save version still works.

type RoomState = { can_edit?: unknown }

/**
 * Whether this browser is the saver: the lowest id among browsers that can edit.
 *
 * A browser on older code has no `can_edit`, and it saves only if it has the lowest id of
 * all, so that id is left to it. (It may be a view-only one, which is no worse than before
 * and ends when that tab reloads.) Any other older browser is waiting for the lowest id too,
 * so it doesn't count. That way a mix of old and new never has two savers.
 */
export function isSaverIn(me: number, canEdit: boolean, states: Map<number, RoomState>) {
  if (!canEdit) return false
  const others = [...states].filter(([id]) => id !== me)
  const lowest = others.reduce<[number, RoomState] | null>((low, entry) => (!low || entry[0] < low[0] ? entry : low), null)
  if (!lowest || me < lowest[0]) return true
  if (lowest[1].can_edit === undefined) return false
  return others.every(([id, state]) => state.can_edit !== true || me < id)
}
