"use client"

import { useEffect, useRef, useState } from "react"

import { FileIcon, FileTextIcon, FolderIcon, PenToolIcon } from "@/components/icons"
import { Skeleton } from "@/components/ui/skeleton"
import { type Folder, foldersApi } from "@/lib/folders-api"
import { cn } from "@/lib/utils"
import { whiteboardApi } from "@/lib/whiteboard-api"

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"]

const MAX_LOADING = 3 // every thumbnail is a Lambda call, and the account's concurrency is small
const LINK_LIFETIME_MS = 4 * 60_000 // download links last 5 minutes
const MAX_IMAGE_BYTES = 8 * 1024 * 1024 // images are shown full size; skip the huge ones
const MAX_SHAPES = 500
const TEXT_CHARS = 500

export function NodeIcon({ node, className }: { node: Pick<Folder, "type">; className?: string }) {
  const Icon = node.type === "note" ? FileTextIcon : node.type === "whiteboard" ? PenToolIcon : node.type === "file" ? FileIcon : FolderIcon
  return <Icon className={cn("size-4 shrink-0 text-muted-foreground", className)} aria-hidden="true" />
}

export function hasThumbnail(node: Folder) {
  if (node.type === "note" || node.type === "whiteboard") return true
  return node.type === "file" && IMAGE_TYPES.includes(node.content_type ?? "") && (node.size ?? 0) <= MAX_IMAGE_BYTES
}

type Thumb = { kind: "image"; url: string } | { kind: "text"; text: string } | { kind: "drawing"; shapes: Shape[]; box: string } | { kind: "none" }

// -- loading: a few at a time, each kept until it could have changed ---------------

let active = 0
const waiting: (() => void)[] = []
const cache = new Map<string, { until: number; thumb: Promise<Thumb> }>()

function inTurn<T>(work: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const start = () => {
      active++
      work()
        .then(resolve, reject)
        .finally(() => {
          active--
          waiting.shift()?.()
        })
    }
    if (active < MAX_LOADING) start()
    else waiting.push(start)
  })
}

async function fetchThumb(node: Folder): Promise<Thumb> {
  if (node.type === "note") {
    const { body } = await foldersApi.readNote(node.id)
    return { kind: "text", text: plainText(body ?? "") }
  }
  if (node.type === "whiteboard") {
    const { elements } = await whiteboardApi.elements(node.id)
    return drawing(elements)
  }
  return { kind: "image", url: (await foldersApi.link(node.id)).url }
}

const keyOf = (node: Folder) => `${node.id}:${node.current_version ?? ""}:${node.updated_at ?? ""}`

function loadThumb(node: Folder) {
  const key = keyOf(node)
  const hit = cache.get(key)
  if (hit && hit.until > Date.now()) return hit.thumb
  if (cache.size > 300) cache.clear()
  const thumb = inTurn(() => fetchThumb(node)).catch((): Thumb => ({ kind: "none" }))
  cache.set(key, { until: Date.now() + LINK_LIFETIME_MS, thumb })
  return thumb
}

// Reading text only: documents are user content, never rendered as HTML.
function plainText(markdown: string) {
  return markdown
    .slice(0, TEXT_CHARS * 2)
    .replace(/^\s{0,3}(#{1,6}|[-*+] \[[ x]\]|[-*+]|>|\d+\.)\s+/gm, "")
    .replace(/[*_`~]/g, "")
    .trim()
    .slice(0, TEXT_CHARS)
}

// -- drawings: a small SVG straight from the board's shapes, without loading the editor ----

type Shape = {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
  points: [number, number][]
  stroke: string
  fill: string
  strokeWidth: number
  opacity: number
  rotate: string | undefined
  lines: string[]
  fontSize: number
}

const num = (value: unknown, fallback = 0) => (typeof value === "number" && Number.isFinite(value) ? value : fallback)

// Colours come from whatever a client saved, so only plain values reach the attribute.
function color(value: unknown, fallback: string) {
  if (typeof value !== "string" || !/^(#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,20})$/.test(value) || value === "transparent") return fallback
  // Default ink follows the theme, so dark mode can still see it.
  return ["#000", "#000000", "#1e1e1e", "black"].includes(value.toLowerCase()) ? "currentColor" : value
}

function drawing(elements: Record<string, unknown>[]): Thumb {
  const shapes: Shape[] = []
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const el of elements) {
    if (el.isDeleted || shapes.length >= MAX_SHAPES) continue
    const [x, y, width, height] = [num(el.x), num(el.y), num(el.width), num(el.height)]
    const points = Array.isArray(el.points)
      ? el.points.filter((p): p is [number, number] => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
      : []
    if (points.length) {
      for (const [dx, dy] of points) {
        minX = Math.min(minX, x + dx)
        maxX = Math.max(maxX, x + dx)
        minY = Math.min(minY, y + dy)
        maxY = Math.max(maxY, y + dy)
      }
    } else {
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x + width)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y + height)
    }
    const angle = num(el.angle)
    shapes.push({
      id: String(el.id),
      type: String(el.type),
      x,
      y,
      width,
      height,
      points,
      stroke: color(el.strokeColor, "currentColor"),
      fill: color(el.backgroundColor, "none"),
      strokeWidth: num(el.strokeWidth, 2),
      opacity: num(el.opacity, 100) / 100,
      rotate: angle ? `rotate(${(angle * 180) / Math.PI} ${x + width / 2} ${y + height / 2})` : undefined,
      lines: typeof el.text === "string" ? el.text.split("\n").slice(0, 20) : [],
      fontSize: num(el.fontSize, 20),
    })
  }
  if (!shapes.length) return { kind: "drawing", shapes, box: "0 0 1 1" }
  const pad = Math.max(maxX - minX, maxY - minY, 40) * 0.05
  return { kind: "drawing", shapes, box: `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}` }
}

function DrawingShape({ shape: s }: { shape: Shape }) {
  const common = { stroke: s.stroke, fill: s.fill, strokeWidth: s.strokeWidth, opacity: s.opacity, transform: s.rotate, vectorEffect: "non-scaling-stroke" as const }
  if (s.type === "text") {
    return (
      <text x={s.x} y={s.y} fontSize={s.fontSize} fill={s.stroke} opacity={s.opacity} transform={s.rotate} dominantBaseline="hanging">
        {s.lines.map((line, i) => (
          <tspan key={i} x={s.x} dy={i ? s.fontSize * 1.25 : 0}>
            {line}
          </tspan>
        ))}
      </text>
    )
  }
  if (s.points.length) {
    return <polyline {...common} fill="none" strokeLinecap="round" strokeLinejoin="round" points={s.points.map(([dx, dy]) => `${s.x + dx},${s.y + dy}`).join(" ")} />
  }
  if (s.type === "ellipse") return <ellipse {...common} cx={s.x + s.width / 2} cy={s.y + s.height / 2} rx={s.width / 2} ry={s.height / 2} />
  if (s.type === "diamond") {
    const [cx, cy] = [s.x + s.width / 2, s.y + s.height / 2]
    return <polygon {...common} points={`${cx},${s.y} ${s.x + s.width},${cy} ${cx},${s.y + s.height} ${s.x},${cy}`} />
  }
  return <rect {...common} x={s.x} y={s.y} width={s.width} height={s.height} />
}

// -- the thumbnail -------------------------------------------------------------------

// A small preview of an image, document or drawing, loaded once it scrolls into view.
// `row` fits a list row; `card` fills its box. Anything without one (folders, PDFs) shows its icon.
export function Thumbnail({ node, variant, className }: { node: Folder; variant: "row" | "card"; className?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [loaded, setLoaded] = useState<{ key: string; thumb: Thumb } | null>(null)
  const key = keyOf(node)
  const eligible = hasThumbnail(node)
  const thumb = loaded?.key === key ? loaded.thumb : null

  useEffect(() => {
    const element = box.current
    if (!element || !eligible) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        setVisible(true)
        observer.disconnect()
      },
      { rootMargin: "200px" }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [eligible])

  useEffect(() => {
    if (!visible || !eligible) return
    let cancelled = false
    void loadThumb(node).then((result) => {
      if (!cancelled) setLoaded({ key, thumb: result })
    })
    return () => {
      cancelled = true
    }
  }, [visible, eligible, key, node])

  const icon = <NodeIcon node={node} className={variant === "card" ? "size-10" : undefined} />
  let content: React.ReactNode = icon
  if (eligible && !thumb) content = <Skeleton className="size-full rounded-none" />
  else if (thumb?.kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL, not a static asset
    content = <img src={thumb.url} alt="" loading="lazy" className="size-full object-cover" onError={() => setLoaded({ key, thumb: { kind: "none" } })} />
  } else if (thumb?.kind === "text" && thumb.text) {
    content = (
      <p className={cn("size-full overflow-hidden text-left break-words whitespace-pre-wrap text-muted-foreground", variant === "card" ? "p-2 text-[10px] leading-snug" : "p-0.5 text-[3px] leading-[4px]")}>
        {thumb.text}
      </p>
    )
  } else if (thumb?.kind === "drawing" && thumb.shapes.length) {
    content = (
      <svg viewBox={thumb.box} preserveAspectRatio="xMidYMid meet" className="size-full p-0.5 text-foreground" aria-hidden="true">
        {thumb.shapes.map((shape) => (
          <DrawingShape key={shape.id} shape={shape} />
        ))}
      </svg>
    )
  }

  return (
    <div
      ref={box}
      aria-hidden="true"
      className={cn("flex items-center justify-center overflow-hidden rounded bg-background", eligible && "border", variant === "row" ? "size-8 shrink-0" : "aspect-video w-full rounded-lg bg-muted/30", className)}
    >
      {content}
    </div>
  )
}
