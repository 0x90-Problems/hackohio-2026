// The board as a list, for people using a keyboard or a screen reader. No editor code in here.
// Everything in a row comes from board content, so it's only ever rendered as text.

export type OutlineElement = {
  id: string
  type: string
  x?: number
  y?: number
  isDeleted?: boolean
  text?: string
  name?: string | null
  containerId?: string | null
  frameId?: string | null
  boundElements?: readonly { id: string; type: string }[] | null
  startBinding?: { elementId: string } | null
  endBinding?: { elementId: string } | null
  customData?: unknown
}

export type OutlineRow = {
  id: string
  kind: string // what it is, in words: "Rectangle", "Arrow"
  label: string // what it says, if anything
  inFrame: boolean
  byAgent: boolean
}

const KINDS: Record<string, string> = {
  rectangle: "Rectangle",
  ellipse: "Ellipse",
  diamond: "Diamond",
  arrow: "Arrow",
  line: "Line",
  freedraw: "Drawing",
  text: "Text",
  frame: "Frame",
  image: "Image",
}

const MAX_LABEL = 120

function short(text: string) {
  const flat = text.replace(/\s+/g, " ").trim()
  return flat.length > MAX_LABEL ? `${flat.slice(0, MAX_LABEL - 1)}…` : flat
}

// Top to bottom, then left to right, the order someone reads a page.
function readingOrder(a: OutlineElement, b: OutlineElement) {
  return (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0) || a.id.localeCompare(b.id)
}

export function outlineOf(elements: readonly OutlineElement[]): OutlineRow[] {
  const live = elements.filter((el) => !el.isDeleted)
  const byId = new Map(live.map((el) => [el.id, el]))

  const textOf = (el: OutlineElement | undefined): string => {
    if (!el) return ""
    if (el.type === "text") return el.text ?? ""
    if (el.type === "frame") return el.name ?? ""
    const bound = el.boundElements?.find((b) => b.type === "text")
    return bound ? (byId.get(bound.id)?.text ?? "") : ""
  }

  const nameOf = (el: OutlineElement | undefined) => {
    if (!el) return ""
    return short(textOf(el)) || (KINDS[el.type] ?? "shape").toLowerCase()
  }

  const row = (el: OutlineElement, inFrame: boolean): OutlineRow => {
    let label = short(textOf(el))
    if (el.type === "arrow" && !label) {
      const [from, to] = [el.startBinding && byId.get(el.startBinding.elementId), el.endBinding && byId.get(el.endBinding.elementId)]
      if (from && to) label = `from ${nameOf(from)} to ${nameOf(to)}`
      else if (from) label = `from ${nameOf(from)}`
      else if (to) label = `to ${nameOf(to)}`
    }
    const author = (el.customData as { created_by?: { type?: string } } | undefined)?.created_by
    return { id: el.id, kind: KINDS[el.type] ?? "Shape", label, inFrame, byAgent: author?.type === "agent" }
  }

  // A label belongs to its shape, and a shape in a frame sits under that frame.
  const shown = live.filter((el) => !(el.type === "text" && el.containerId && byId.has(el.containerId)))
  const frames = new Set(shown.filter((el) => el.type === "frame").map((el) => el.id))
  const inFrame = (el: OutlineElement) => Boolean(el.frameId && frames.has(el.frameId))

  const rows: OutlineRow[] = []
  for (const el of shown.filter((candidate) => !inFrame(candidate)).sort(readingOrder)) {
    rows.push(row(el, false))
    if (el.type === "frame") {
      for (const child of shown.filter((candidate) => candidate.frameId === el.id).sort(readingOrder)) rows.push(row(child, true))
    }
  }
  return rows
}

export function describeRow(row: OutlineRow) {
  const words = row.label ? `${row.kind}: ${row.label}` : row.kind
  const where = row.inFrame ? ", in the frame above" : ""
  return `${words}${where}${row.byAgent ? ", added by an agent" : ""}`
}

export function matchesFilter(row: OutlineRow, filter: string) {
  const wanted = filter.trim().toLowerCase()
  return !wanted || `${row.kind} ${row.label}`.toLowerCase().includes(wanted)
}
