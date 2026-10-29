"use client"

import { useRef, useState } from "react"

import { TicketOwnerBadge } from "@/components/actor-badge"
import { ColorDot } from "@/components/board/category-dialogs"
import { Button } from "@/components/ui/button"
import { CATEGORY_COLORS, categoryName } from "@/lib/categories"
import type { Category, Ticket } from "@/lib/types"
import { cn } from "@/lib/utils"

const DAY = 86_400_000
type Zoom = "weeks" | "months"
const DAY_WIDTH: Record<Zoom, number> = { weeks: 28, months: 8 }

// Local midnight, so a YYYY-MM-DD due date lands on the day the user picked.
function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function parseDay(value: string | undefined) {
  if (!value) return undefined
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day)
}

function daysBetween(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / DAY)
}

// Calendar arithmetic, not `+ n * DAY`: a DST change makes a day 23 or 25 hours,
// which would push every later "midnight" onto the wrong date.
function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

const shortDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" })

// YYYY-MM-DD in local time (the format tickets store).
export function formatDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

type DragMode = "move" | "start" | "end"

// New start/due for a bar dragged by `days`. Ends never cross: a start can't pass the due date.
export function draggedDates(span: { start: Date; end: Date; kind: "range" | "start" | "none" }, mode: DragMode, days: number) {
  if (span.kind === "start") {
    if (mode === "end") return { start: span.start, end: addDays(span.start, Math.max(0, days)) as Date | undefined }
    return { start: addDays(span.start, days), end: undefined as Date | undefined }
  }
  if (mode === "move") return { start: addDays(span.start, days), end: addDays(span.end, days) as Date | undefined }
  if (mode === "start") {
    const start = addDays(span.start, days)
    return { start: start > span.end ? span.end : start, end: span.end as Date | undefined }
  }
  const end = addDays(span.end, days)
  return { start: span.start, end: (end < span.start ? span.start : end) as Date | undefined }
}

// "range": start and end known. "start": only a start date. "none": no dates.
type Span = { ticket: Ticket; start: Date; end: Date; kind: "range" | "start" | "none" }

// Where a ticket sits on the timeline. Bars run from the start date (or, without
// one, the day it was created) to the due date.
export function ticketSpan(ticket: Ticket, today: Date = startOfDay(new Date())): Span {
  // The board API falls back to the epoch for a missing created_at; a 1970 date
  // would stretch the timeline across ~20,000 days, so treat it as unknown.
  const created = ticket.created_at.getTime() > 0 ? startOfDay(ticket.created_at) : undefined
  const start = parseDay(ticket.start_date)
  const due = parseDay(ticket.due_date)
  if (due) {
    // A start after the due date (e.g. set through the API) collapses to the due day.
    const from = start ?? created
    return { ticket, start: from && from <= due ? from : due, end: due, kind: "range" }
  }
  if (start) return { ticket, start, end: start, kind: "start" }
  const at = created ?? today
  return { ticket, start: at, end: at, kind: "none" }
}

// Roadmap timeline: one lane per column (Now / Next / Later ...), one bar per
// ticket. Tickets without dates show as a dashed marker so nothing on the
// roadmap silently disappears.
export function TimelineView({
  tickets,
  categories,
  onOpenTicket,
  onDatesChange,
}: {
  tickets: Ticket[]
  categories: Category[]
  onOpenTicket: (ticket: Ticket) => void
  onDatesChange?: (ticketKey: string, start: string, due: string) => void
}) {
  const [zoom, setZoom] = useState<Zoom>("weeks")
  const today = startOfDay(new Date())

  const spans = tickets.map((ticket) => ticketSpan(ticket, today))

  if (spans.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        No tickets to show. Add a ticket (or clear the owner filter) and give it a start and due date to see it on
        the timeline.
      </div>
    )
  }

  let earliest = today
  let latest = today
  for (const span of spans) {
    if (span.start < earliest) earliest = span.start
    if (span.end > latest) latest = span.end
  }
  const rangeStart = addDays(earliest, -7)
  const totalDays = Math.max(42, daysBetween(rangeStart, latest) + 14)
  const dayWidth = DAY_WIDTH[zoom]
  const trackWidth = totalDays * dayWidth
  const offset = (date: Date) => daysBetween(rangeStart, date) * dayWidth

  const months: Date[] = []
  const weekStarts: Date[] = []
  const days: Date[] = []
  // Label the partial first month only if it has room before the next month's label.
  const nextMonth = new Date(rangeStart.getFullYear(), rangeStart.getMonth() + 1, 1)
  if (rangeStart.getDate() !== 1 && daysBetween(rangeStart, nextMonth) * dayWidth >= 120) months.push(rangeStart)
  for (let index = 0; index < totalDays; index++) {
    const day = addDays(rangeStart, index)
    if (day.getDate() === 1) months.push(day)
    if (day.getDay() === 1) weekStarts.push(day)
    days.push(day)
  }

  const known = new Set(categories.map((category) => category.slug))
  const lanes = [
    ...[...categories].sort((a, b) => a.order - b.order).map((category) => ({
      slug: category.slug,
      name: category.name,
      color: category.color,
    })),
    ...[...new Set(spans.map((span) => span.ticket.status).filter((status) => !known.has(status)))].map(
      (status) => ({ slug: status, name: categoryName(status, categories), color: "gray" as const })
    ),
  ]
    .map((lane) => ({
      ...lane,
      spans: spans
        .filter((span) => span.ticket.status === lane.slug)
        .sort((a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime()),
    }))
    .filter((lane) => lane.spans.length > 0)

  let row = 0

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Timeline zoom" className="flex gap-1 rounded-lg border bg-muted/40 p-1">
          {(["weeks", "months"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={zoom === option}
              onClick={() => setZoom(option)}
              className={cn(
                "rounded-md px-3 py-1 text-sm capitalize transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                zoom === option
                  ? "bg-background font-medium text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {option}
            </button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            document
              .getElementById("timeline-today")
              ?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
          }
        >
          Today
        </Button>
      </div>

      <div className="w-full min-w-0 overflow-x-auto rounded-lg border">
        <div className="grid" style={{ gridTemplateColumns: `minmax(9rem, 14rem) ${trackWidth}px` }}>
          {/* Header: month labels and week ticks */}
          <div className="sticky left-0 z-20 border-r border-b bg-background p-2 text-xs font-medium text-muted-foreground">
            Ticket
          </div>
          <div className="relative h-14 border-b bg-muted/30">
            {/* Axis ticks: every day (with its number) in Weeks zoom, every week in Months zoom. */}
            {zoom === "weeks"
              ? days.map((day) => (
                  <span
                    key={`d-${day.getTime()}`}
                    aria-hidden="true"
                    className={cn(
                      "absolute bottom-0 border-l text-center text-[10px] leading-none text-muted-foreground",
                      day.getDay() === 1 ? "h-3 border-foreground/30" : "h-1.5 border-foreground/15"
                    )}
                    style={{ left: offset(day), width: dayWidth }}
                  >
                    <span className="absolute -top-3.5 left-0 w-full">{day.getDate()}</span>
                  </span>
                ))
              : weekStarts.map((week) => (
                  <span
                    key={`t-${week.getTime()}`}
                    aria-hidden="true"
                    className="absolute bottom-0 h-2 border-l border-foreground/25"
                    style={{ left: offset(week) }}
                  />
                ))}
            {months.map((month) => (
              <span
                key={`m-${month.getTime()}`}
                className="absolute top-1.5 border-l pl-1.5 text-xs font-medium whitespace-nowrap"
                style={{ left: offset(month) }}
              >
                {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </span>
            ))}
            {weekStarts.map((week) => (
              <span
                key={`w-${week.getTime()}`}
                className={cn(
                  "absolute pl-1 text-[11px] whitespace-nowrap text-muted-foreground",
                  zoom === "weeks" ? "top-6" : "bottom-2.5"
                )}
                style={{ left: offset(week) }}
              >
                {shortDate.format(week)}
              </span>
            ))}
          </div>

          {lanes.map((lane) => (
            <div key={lane.slug} role="group" aria-label={lane.name} className="contents">
              <div className="sticky left-0 z-10 flex items-center gap-2 border-r border-b bg-muted/40 px-2 py-1.5 text-sm font-medium">
                <ColorDot color={lane.color} />
                {lane.name}
                <span className="text-xs font-normal text-muted-foreground">{lane.spans.length}</span>
              </div>
              <div className="relative border-b bg-muted/20">
                <TodayLine left={offset(today)} id={lane === lanes[0] ? "timeline-today" : undefined} />
              </div>

              {lane.spans.map((span) => {
                const index = row++
                const { ticket } = span
                const left = offset(span.start)
                const width = Math.max(dayWidth, (daysBetween(span.start, span.end) + 1) * dayWidth)
                const milestone = ticket.fields?.Milestone
                const dated = span.kind === "range"
                const label =
                  span.kind === "range"
                    ? `${ticket.key} ${ticket.title}, ${shortDate.format(span.start)} to ${shortDate.format(span.end)}`
                    : span.kind === "start"
                      ? `${ticket.key} ${ticket.title}, starts ${shortDate.format(span.start)}, no due date`
                      : `${ticket.key} ${ticket.title}, no dates`
                return (
                  <div key={ticket.key} className="contents">
                    <button
                      type="button"
                      onClick={() => onOpenTicket(ticket)}
                      className="sticky left-0 z-10 flex min-w-0 flex-col items-start gap-0.5 border-r border-b bg-background px-2 py-1.5 text-left hover:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      <span className="w-full truncate text-sm font-medium" title={ticket.title}>
                        {ticket.title}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {ticket.key}
                        <TicketOwnerBadge ticket={ticket} />
                      </span>
                    </button>
                    <div className="relative h-14 border-b">
                      <WeekLines lefts={weekStarts.map(offset)} />
                      <TodayLine left={offset(today)} />
                      <TimelineBar
                        span={span}
                        label={label}
                        text={dated ? milestone || ticket.title : span.kind === "start" ? "No due date" : "No dates"}
                        className={
                          dated ? CATEGORY_COLORS[lane.color].card : "border border-dashed bg-background text-muted-foreground"
                        }
                        dated={dated}
                        left={left}
                        width={width}
                        dayWidth={dayWidth}
                        offset={offset}
                        delay={Math.min(index, 12) * 30}
                        onOpen={() => onOpenTicket(ticket)}
                        onCommit={
                          onDatesChange
                            ? (next) =>
                                onDatesChange(ticket.key, formatDay(next.start), next.end ? formatDay(next.end) : ticket.due_date ?? "")
                            : undefined
                        }
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Bars run from a ticket&apos;s start date (or the day it was created) to its due date. Drag a bar to move it,
        or drag either end to change that date.
      </p>
    </div>
  )
}

function WeekLines({ lefts }: { lefts: number[] }) {
  return (
    <>
      {lefts.map((left) => (
        <span key={left} aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-px bg-foreground/5" style={{ left }} />
      ))}
    </>
  )
}

function TodayLine({ left, id }: { left: number; id?: string }) {
  return (
    <span
      id={id}
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 w-px bg-foreground/40"
      style={{ left }}
    />
  )
}

type Drag = { mode: DragMode; days: number }

// One ticket's bar. Drag the body to move both dates, an end to change that date;
// a press without movement is a click (opens the ticket). Keyboard: Enter opens,
// arrows move a day, Shift + arrows change the due date.
function TimelineBar({
  span,
  label,
  text,
  className,
  dated,
  left,
  width,
  dayWidth,
  offset,
  delay,
  onOpen,
  onCommit,
}: {
  span: Span
  label: string
  text: string
  className: string
  dated: boolean
  left: number
  width: number
  dayWidth: number
  offset: (date: Date) => number
  delay: number
  onOpen: () => void
  onCommit?: (next: { start: Date; end: Date | undefined }) => void
}) {
  // The drag in progress, by whole days (a preview until release).
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragOrigin = useRef<{ x: number; moved: boolean } | null>(null)
  const editable = Boolean(onCommit) && span.kind !== "none"
  const preview = drag ? draggedDates(span, drag.mode, drag.days) : null
  const shownStart = preview?.start ?? span.start
  const shownEnd = preview?.end ?? span.end
  const commit = (mode: DragMode, days: number) => {
    if (days && onCommit) onCommit(draggedDates(span, mode, days))
  }
  // The pressed part says what it drags (data-drag: move | start | end).
  const begin = (event: React.PointerEvent<HTMLElement>) => {
    if (!editable || event.button !== 0) return
    event.stopPropagation()
    const mode = (event.currentTarget.dataset.drag ?? "move") as DragMode
    event.currentTarget.setPointerCapture(event.pointerId)
    dragOrigin.current = { x: event.clientX, moved: false }
    setDrag({ mode, days: 0 })
  }
  const move = (event: React.PointerEvent<HTMLElement>) => {
    if (!dragOrigin.current || !drag) return
    const dx = event.clientX - dragOrigin.current.x
    if (Math.abs(dx) > 3) dragOrigin.current.moved = true
    const days = Math.round(dx / dayWidth)
    if (days !== drag.days) setDrag({ ...drag, days })
  }
  const end = (event: React.PointerEvent<HTMLElement>) => {
    event.stopPropagation()
    const moved = dragOrigin.current?.moved
    const current = drag
    dragOrigin.current = null
    setDrag(null)
    if (current && moved) commit(current.mode, current.days)
    else if (current?.mode === "move") onOpen() // a click, not a drag
  }
  const cancel = () => {
    dragOrigin.current = null
    setDrag(null)
  }
  const previewText = preview
    ? `${shortDate.format(shownStart)}${preview.end ? ` – ${shortDate.format(shownEnd)}` : ""}`
    : null
  const handle = "absolute inset-y-0 w-2 cursor-ew-resize opacity-0 group-hover:bg-foreground/15 group-hover:opacity-100"

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={
        editable
          ? `${label}. Drag to move, or drag an end to change a date. Arrow keys move it a day; Shift and arrows change the due date.`
          : label
      }
      title={previewText ?? label}
      data-drag="move"
      onPointerDown={editable ? begin : undefined}
      onPointerMove={move}
      onPointerUp={editable ? end : undefined}
      onPointerCancel={cancel}
      onClick={editable ? undefined : onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onOpen()
        } else if (editable && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
          event.preventDefault()
          commit(event.shiftKey ? "end" : "move", event.key === "ArrowLeft" ? -1 : 1)
        }
      }}
      className={cn(
        "group absolute top-1/2 flex h-8 -translate-y-1/2 touch-none items-center gap-1.5 overflow-hidden rounded-full px-2.5 text-xs font-medium whitespace-nowrap shadow-xs transition-shadow select-none hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300",
        editable ? (drag ? "cursor-grabbing shadow-lg" : "cursor-grab") : "cursor-pointer",
        className
      )}
      style={{
        left: preview ? offset(shownStart) : left,
        width: preview?.end
          ? Math.max(dayWidth, (daysBetween(shownStart, shownEnd) + 1) * dayWidth)
          : dated
            ? width
            : undefined,
        minWidth: dated || preview?.end ? undefined : "7rem",
        animationDelay: `${delay}ms`,
      }}
    >
      {editable && span.kind === "range" ? (
        <span aria-hidden="true" data-drag="start" onPointerDown={begin} onPointerMove={move} onPointerUp={end} className={cn(handle, "left-0 rounded-l-full")} />
      ) : null}
      <span className="truncate">{previewText ?? text}</span>
      {editable ? (
        <span aria-hidden="true" data-drag="end" onPointerDown={begin} onPointerMove={move} onPointerUp={end} className={cn(handle, "right-0 rounded-r-full")} />
      ) : null}
    </div>
  )
}
