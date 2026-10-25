"use client"

import { useState } from "react"
import type { Ticket, User } from "@/lib/types"
import { TicketOwnerBadge } from "@/components/actor-badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const PROJECT_VIEWS = ["board", "calendar"] as const

export type ProjectView = (typeof PROJECT_VIEWS)[number]

export type ProjectFilters = {
  owner: string
}

const VIEW_LABELS: Record<ProjectView, string> = {
  board: "Board",
  calendar: "Calendar",
}

export function ticketOwnerId(ticket: Ticket) {
  const creator = ticket.created_by
  const defaultOwner =
    "acting_for" in creator ? creator.acting_for : creator.id
  return ticket.owner_id ?? defaultOwner
}

export function filterProjectTickets(
  tickets: Ticket[],
  filters: ProjectFilters
) {
  return tickets.filter(
    (ticket) => !filters.owner || ticketOwnerId(ticket) === filters.owner
  )
}

export function ProjectViews({
  tickets,
  owners,
  view,
  onViewChange,
  filters,
  onFiltersChange,
  onOpenTicket,
  onDueDateChange,
}: {
  tickets: Ticket[]
  owners: User[]
  view: ProjectView
  onViewChange: (view: ProjectView) => void
  filters: ProjectFilters
  onFiltersChange: (filters: ProjectFilters) => void
  onOpenTicket: (ticket: Ticket) => void
  onDueDateChange: (ticketKey: string, date: string) => void
}) {
  const filteredTickets = filterProjectTickets(tickets, filters)

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Project views"
          className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1"
          onKeyDown={(event) => {
            const current = PROJECT_VIEWS.indexOf(view)
            let next = current
            if (event.key === "ArrowRight")
              next = (current + 1) % PROJECT_VIEWS.length
            if (event.key === "ArrowLeft")
              next = (current - 1 + PROJECT_VIEWS.length) % PROJECT_VIEWS.length
            if (event.key === "Home") next = 0
            if (event.key === "End") next = PROJECT_VIEWS.length - 1
            if (next !== current) {
              event.preventDefault()
              const nextView = PROJECT_VIEWS[next]
              onViewChange(nextView)
              document.getElementById(`project-view-${nextView}`)?.focus()
            }
          }}
        >
          {PROJECT_VIEWS.map((option) => (
            <button
              key={option}
              id={`project-view-${option}`}
              type="button"
              role="tab"
              aria-selected={view === option}
              tabIndex={view === option ? 0 : -1}
              onClick={() => onViewChange(option)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                view === option
                  ? "bg-background font-medium text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {VIEW_LABELS[option]}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          Filter by owner
          <select
            aria-label="Filter by owner"
            value={filters.owner}
            onChange={(event) =>
              onFiltersChange({ ...filters, owner: event.target.value })
            }
            className="h-9 min-w-36 rounded-md border bg-background px-2"
          >
            <option value="">All owners</option>
            {owners.map((owner) => (
              <option key={owner._id} value={owner._id}>
                {owner.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {view === "calendar" && (
        <CalendarView
          tickets={filteredTickets}
          onOpenTicket={onOpenTicket}
          onDueDateChange={onDueDateChange}
        />
      )}
    </section>
  )
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function CalendarView({
  tickets,
  onOpenTicket,
  onDueDateChange,
}: {
  tickets: Ticket[]
  onOpenTicket: (ticket: Ticket) => void
  onDueDateChange: (ticketKey: string, date: string) => void
}) {
  const [monthOffset, setMonthOffset] = useState(0)
  const [draggingTicket, setDraggingTicket] = useState<string | null>(null)
  const now = new Date()
  const activeMonth = new Date(
    now.getFullYear(),
    now.getMonth() + monthOffset,
    1
  )
  const daysInMonth = new Date(
    activeMonth.getFullYear(),
    activeMonth.getMonth() + 1,
    0
  ).getDate()
  const days = Array.from(
    { length: daysInMonth },
    (_, index) =>
      new Date(activeMonth.getFullYear(), activeMonth.getMonth(), index + 1)
  )
  const title = activeMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  })

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b bg-background/95 py-2 backdrop-blur">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMonthOffset((value) => value - 1)}
          aria-label="Previous month"
        >
          ←
        </Button>
        <Button variant="outline" size="sm" onClick={() => setMonthOffset(0)}>
          Today
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMonthOffset((value) => value + 1)}
          aria-label="Next month"
        >
          →
        </Button>
        <h2 className="ml-2 font-semibold">{title}</h2>
      </div>
      <div className="w-full overflow-x-auto rounded-lg border">
        <div className="grid w-max grid-cols-[repeat(7,9rem)]">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="border-r border-b bg-muted/30 p-2 text-xs font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
          {Array.from({ length: days[0].getDay() }, (_, index) => (
            <div
              key={`pad-${index}`}
              aria-hidden="true"
              className="min-h-24 border-r border-b bg-muted/10"
            />
          ))}
          {days.map((day) => {
            const date = formatDate(day)
            const dayTickets = tickets.filter(
              (ticket) => ticket.due_date === date
            )

            return (
              <div
                key={date}
                onDragOver={(event) => {
                  if (draggingTicket) event.preventDefault()
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  if (draggingTicket) {
                    onDueDateChange(draggingTicket, date)
                    setDraggingTicket(null)
                  }
                }}
                className="min-h-24 border-r border-b p-1.5"
              >
                <span className="text-xs text-muted-foreground">
                  {day.getDate()}
                </span>
                <div className="mt-1 flex flex-col gap-1">
                  {dayTickets.map((ticket) => (
                    <div
                      key={ticket.key}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", ticket.key)
                        setDraggingTicket(ticket.key)
                      }}
                      onDragEnd={() => setDraggingTicket(null)}
                      className="min-w-0 rounded bg-muted p-1.5"
                    >
                      <button
                        type="button"
                        onClick={() => onOpenTicket(ticket)}
                        className="block w-full truncate text-left text-xs font-medium hover:underline"
                        title={`${ticket.title} · ${ticket.key}`}
                      >
                        {ticket.title}
                      </button>
                      <div className="mt-1 flex flex-col gap-1 overflow-hidden text-[10px]">
                        <TicketOwnerBadge ticket={ticket} />
                      </div>
                      <input
                        aria-label={`Edit due date ${ticket.key}`}
                        type="date"
                        value={ticket.due_date ?? ""}
                        onChange={(event) =>
                          onDueDateChange(ticket.key, event.target.value)
                        }
                        className="mt-1 w-full rounded border bg-background px-1 py-0.5 text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
