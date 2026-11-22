// Scrolling while dragging a card: the browser's drag and drop doesn't scroll the board, so far
// columns were out of reach. Near an edge the view scrolls toward it, faster the closer you are.

/** How close to an edge (px) scrolling starts. */
export const EDGE = 80
/** Fastest scroll, in px per frame, right at the edge. */
export const MAX_SPEED = 24

/** Speed along one axis: negative toward the start edge, positive toward the end, 0 in the middle. */
export function edgeSpeed(pointer: number, start: number, end: number, edge = EDGE, max = MAX_SPEED): number {
  if (end - start <= edge * 2) return 0
  if (pointer < start || pointer > end) return 0
  if (pointer < start + edge) return -Math.ceil(max * ((start + edge - pointer) / edge))
  if (pointer > end - edge) return Math.ceil(max * ((pointer - (end - edge)) / edge))
  return 0
}
