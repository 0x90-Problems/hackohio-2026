"use client"

import { useState } from "react"

import { TicketOwnerBadge } from "@/components/actor-badge"
import { ColorDot } from "@/components/board/category-dialogs"
import { Button } from "@/components/ui/button"
import { CATEGORY_COLORS } from "@/lib/categories"
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

const shortDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" })

type Span = { ticket: Ticket; start: Date; end: Date; dated: boolean }

// Roadmap timeline: one lane per column (Now / Next / Later ...), one bar per
// ticket from when it was created to its due date. Undated tickets show as a
// dashed marker so nothing on the roadmap silently disappears.
export function TimelineView({
  tickets,
  categories,
  onOpenTicket,
}: {
  tickets: Ticket[]
  categories: Category[]
  onOpenTicket: (ticket: Ticket) => void
}) {
  const [zoom, setZoom] = useState<Zoom>("weeks")
  const today = startOfDay(new Date())

  const spans: Span[] = tickets.map((ticket) => {
    const created = startOfDay(ticket.created_at)
    const due = parseDay(ticket.due_date)
    if (!due) return { ticket, start: created, end: created, dated: false }
    return due < created
      ? { ticket, start: due, end: due, dated: true }
      : { ticket, start: created, end: due, dated: true }
  })

  if (spans.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        Nothing on the roadmap yet. Add a ticket, and give it a due date to see it on the timeline.
      </div>
    )
  }

  const earliest = Math.min(today.getTime(), ...spans.map((span) => span.start.getTime()))
  const latest = Math.max(today.getTime(), ...spans.map((span) => span.end.getTime()))
  const rangeStart = new Date(earliest - 7 * DAY)
  const totalDays = Math.max(42, daysBetween(rangeStart, new Date(latest)) + 14)
  const dayWidth = DAY_WIDTH[zoom]
  const trackWidth = totalDays * dayWidth
  const offset = (date: Date) => daysBetween(rangeStart, date) * dayWidth

  const days = Array.from({ length: totalDays }, (_, index) => new Date(rangeStart.getTime() + index * DAY))
  const months = days.filter((day, index) => index === 0 || day.getDate() === 1)
  const weekStarts = days.filter((day) => day.getDay() === 1)

  const known = new Set(categories.map((category) => category.slug))
  const lanes = [
    ...[...categories].sort((a, b) => a.order - b.order).map((category) => ({
      slug: category.slug,
      name: category.name,
      color: category.color,
    })),
    ...[...new Set(spans.map((span) => span.ticket.status).filter((status) => !known.has(status)))].map(
      (status) => ({ slug: status, name: status, color: "gray" as const })
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
          <div className="relative h-12 border-b bg-muted/30">
            {months.map((month) => (
              <span
                key={`m-${month.getTime()}`}
                className="absolute top-1.5 border-l pl-1.5 text-xs font-medium whitespace-nowrap"
                style={{ left: offset(month) }}
              >
                {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </span>
            ))}
            {zoom === "weeks" &&
              weekStarts.map((week) => (
                <span
                  key={`w-${week.getTime()}`}
                  className="absolute bottom-1 pl-1 text-[11px] whitespace-nowrap text-muted-foreground"
                  style={{ left: offset(week) }}
                >
                  {shortDate.format(week)}
                </span>
              ))}
          </div>

          {lanes.map((lane) => (
            <div key={lane.slug} role="list" aria-label={lane.name} className="contents">
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
                const label = span.dated
                  ? `${ticket.key} ${ticket.title}, ${shortDate.format(span.start)} to ${shortDate.format(span.end)}`
                  : `${ticket.key} ${ticket.title}, no due date`
                return (
                  <div key={ticket.key} role="listitem" className="contents">
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
                      <TodayLine left={offset(today)} />
                      <button
                        type="button"
                        aria-label={label}
                        title={label}
                        onClick={() => onOpenTicket(ticket)}
                        className={cn(
                          "absolute top-1/2 flex h-8 -translate-y-1/2 items-center gap-1.5 overflow-hidden rounded-full px-2.5 text-xs font-medium whitespace-nowrap shadow-xs transition-shadow hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300",
                          span.dated
                            ? CATEGORY_COLORS[lane.color].card
                            : "border border-dashed bg-background text-muted-foreground"
                        )}
                        style={{
                          left,
                          width: span.dated ? width : undefined,
                          minWidth: span.dated ? undefined : "7rem",
                          animationDelay: `${Math.min(index, 12) * 30}ms`,
                        }}
                      >
                        <span className="truncate">{span.dated ? milestone || ticket.title : "No due date"}</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Bars run from when a ticket was created to its due date. Set due dates in the ticket or the Calendar view.
      </p>
    </div>
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
