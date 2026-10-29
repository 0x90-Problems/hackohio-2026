"use client"

import { useState } from "react"

import { ChevronRightIcon, GripVerticalIcon } from "@/components/icons"
import { ColorDot } from "@/components/board/category-dialogs"
import { DeleteCardButton } from "@/components/board/delete-card-button"
import { CATEGORY_COLORS } from "@/lib/categories"
import type { Category, Ticket } from "@/lib/types"
import { cn } from "@/lib/utils"

const GROUP_DRAG_TYPE = "application/x-nutshell-category"

// GitHub Projects table: one section per status column, one row per ticket.
// Titles wrap. A field with no value yet is an empty muted cell.
export function TableView({
  tickets,
  categories,
  fields,
  onOpenTicket,
  onMoveCategory,
  onDelete,
}: {
  tickets: Ticket[]
  categories: Category[]
  fields: string[]
  onOpenTicket: (ticket: Ticket) => void
  onMoveCategory?: (slug: string, toIndex: number) => void
  onDelete: (ticketKey: string) => void
}) {
  const [closed, setClosed] = useState<Record<string, boolean>>({})
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const known = new Set(categories.map((category) => category.slug))
  const extras = tickets
    .filter((ticket) => !known.has(ticket.status))
    .reduce<Map<string, Ticket[]>>((groups, ticket) => {
      const rows = groups.get(ticket.status) ?? []
      rows.push(ticket)
      groups.set(ticket.status, rows)
      return groups
    }, new Map())
  const groups: { slug: string; name: string; color: Category["color"]; tickets: Ticket[] }[] = [
    ...categories.map((category) => ({
      slug: category.slug,
      name: category.name,
      color: category.color,
      tickets: tickets.filter((ticket) => ticket.status === category.slug),
    })),
    ...[...extras.entries()].map(([slug, rows]) => ({
      slug,
      name: slug,
      color: "gray" as const,
      tickets: rows,
    })),
  ]

  return (
    <div data-slot="project-table" data-layout="table" className="flex flex-col gap-4">
      {groups.map((group, index) => {
        const open = !closed[group.slug]
        const panelId = `table-group-${group.slug}`
        // Only real categories reorder; groups for unknown statuses stay at the end.
        const movable = Boolean(onMoveCategory) && index < categories.length
        return (
          <section
            key={group.slug}
            onDragOver={(event) => {
              if (!movable || !event.dataTransfer.types.includes(GROUP_DRAG_TYPE)) return
              event.preventDefault()
              event.dataTransfer.dropEffect = "move"
              setDropTarget(group.slug)
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropTarget(null)
            }}
            onDrop={(event) => {
              const slug = event.dataTransfer.getData(GROUP_DRAG_TYPE)
              setDropTarget(null)
              if (slug && movable) onMoveCategory?.(slug, index)
            }}
            className={cn(
              "overflow-hidden rounded-xl border bg-card transition-shadow duration-150",
              dropTarget === group.slug && "shadow-lg ring-2 ring-foreground/40"
            )}
          >
            <div className="flex items-center">
            {movable ? (
              <button
                type="button"
                draggable
                aria-label={`Reorder ${group.name} (arrow keys move it)`}
                title="Drag to reorder"
                onDragStart={(event) => {
                  event.dataTransfer.setData(GROUP_DRAG_TYPE, group.slug)
                  event.dataTransfer.effectAllowed = "move"
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                    event.preventDefault()
                    onMoveCategory?.(group.slug, index + (event.key === "ArrowUp" ? -1 : 1))
                  }
                }}
                className="ml-2 cursor-grab rounded-sm p-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none active:cursor-grabbing"
              >
                <GripVerticalIcon className="size-4" aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() =>
                setClosed((current) => ({ ...current, [group.slug]: open }))
              }
              className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-muted/40"
            >
              <ChevronRightIcon
                aria-hidden="true"
                className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")}
              />
              <ColorDot color={group.color} />
              <span className="min-w-0 flex-1 font-medium whitespace-normal break-words">
                {group.name}
              </span>
              <span className="text-sm text-muted-foreground tabular-nums">{group.tickets.length}</span>
            </button>
            </div>
            {open && (
              <div id={panelId} className="border-t">
                <table className="w-full table-fixed border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left">
                      <th className="w-[40%] px-4 py-2 font-medium whitespace-normal">Title</th>
                      <th className="px-4 py-2 font-medium whitespace-normal">Status</th>
                      {fields.map((field) => (
                        <th key={field} className="px-4 py-2 font-medium whitespace-normal break-words">
                          {field}
                        </th>
                      ))}
                      <th className="w-16 px-4 py-2 font-medium">
                        <span className="sr-only">Delete</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.tickets.length === 0 ? (
                      <tr>
                        <td
                          colSpan={3 + fields.length}
                          className="px-4 py-3 text-muted-foreground"
                        >
                          No tickets
                        </td>
                      </tr>
                    ) : (
                      group.tickets.map((ticket) => (
                        <tr key={ticket.key} className="border-b last:border-b-0">
                          <td className="px-4 py-3 align-top">
                            <button
                              type="button"
                              onClick={() => onOpenTicket(ticket)}
                              className="block w-full text-left whitespace-normal break-words hover:underline"
                            >
                              <span className="mr-2 font-mono text-xs text-muted-foreground">
                                {ticket.key}
                              </span>
                              <span className="font-medium">{ticket.title}</span>
                            </button>
                          </td>
                          <td className="px-4 py-3 align-top whitespace-normal break-words">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium whitespace-normal break-words",
                                CATEGORY_COLORS[group.color].card
                              )}
                            >
                              <span
                                className={cn("size-2 shrink-0 rounded-full", CATEGORY_COLORS[group.color].dot)}
                              />
                              {group.name}
                            </span>
                          </td>
                          {fields.map((field) => {
                            const value = fieldText(ticket, field)
                            return (
                              <td
                                key={field}
                                className={cn(
                                  "px-4 py-3 align-top whitespace-normal break-words",
                                  value ? "text-foreground" : "text-muted-foreground"
                                )}
                              >
                                {value || "—"}
                              </td>
                            )
                          })}
                          <td className="px-4 py-3 align-top">
                            <DeleteCardButton ticketKey={ticket.key} onDelete={onDelete} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

function fieldText(ticket: Ticket, field: string) {
  const value = ticket.fields?.[field]
  return typeof value === "string" ? value.trim() : ""
}
