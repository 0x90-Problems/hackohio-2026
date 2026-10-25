"use client"

import { useState } from "react"

import { ChevronRightIcon } from "@/components/icons"
import { ColorDot } from "@/components/board/category-dialogs"
import { CATEGORY_COLORS } from "@/lib/categories"
import type { Category, Ticket } from "@/lib/types"
import { cn } from "@/lib/utils"

// GitHub Projects table: one section per status column, one row per ticket.
// Titles wrap. A field with no value yet is an empty muted cell.
export function TableView({
  tickets,
  categories,
  fields,
  onOpenTicket,
}: {
  tickets: Ticket[]
  categories: Category[]
  fields: string[]
  onOpenTicket: (ticket: Ticket) => void
}) {
  const [closed, setClosed] = useState<Record<string, boolean>>({})
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
      {groups.map((group) => {
        const open = !closed[group.slug]
        const panelId = `table-group-${group.slug}`
        return (
          <section key={group.slug} className="overflow-hidden rounded-xl border bg-card">
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
                    </tr>
                  </thead>
                  <tbody>
                    {group.tickets.length === 0 ? (
                      <tr>
                        <td
                          colSpan={2 + fields.length}
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
