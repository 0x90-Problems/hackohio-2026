"use client"

import { useState } from "react"

import { ChevronRightIcon, GripVerticalIcon, PlusIcon } from "@/components/icons"
import { ColorDot } from "@/components/board/category-dialogs"
import { DeleteCardButton } from "@/components/board/delete-card-button"
import { FieldCell, FieldDialog, type FieldDraft, type Person } from "@/components/board/table-fields"
import { Button } from "@/components/ui/button"
import { CATEGORY_COLORS } from "@/lib/categories"
import type { FieldDef } from "@/lib/table-fields"
import type { Category, Ticket } from "@/lib/types"
import { cn } from "@/lib/utils"

const GROUP_DRAG_TYPE = "application/x-nutshell-category"

// GitHub Projects table: one section per status column, one row per ticket.
// Titles wrap. Each field column has a type (NSB-94); its cells edit in place.
export function TableView({
  tickets,
  categories,
  fields,
  users,
  onOpenTicket,
  onMoveCategory,
  onDelete,
  onFieldsChange,
  onFieldValue,
}: {
  tickets: Ticket[]
  categories: Category[]
  fields: FieldDef[]
  users: Person[]
  onOpenTicket: (ticket: Ticket) => void
  onMoveCategory?: (slug: string, toIndex: number) => void
  onDelete: (ticketKey: string) => void
  onFieldsChange?: (fields: FieldDraft[]) => Promise<boolean>
  onFieldValue?: (ticketKey: string, field: FieldDef, value: string) => void
}) {
  // The field being edited in the dialog, or "new" while adding one.
  const [editingField, setEditingField] = useState<FieldDef | "new" | null>(null)
  const drafts = (): FieldDraft[] => fields.map(({ id, name, type, options }) => ({ id, name, type, ...(options ? { options } : {}) }))
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
      {onFieldsChange && editingField !== null && (
        <FieldDialog
          key={editingField === "new" ? "new" : editingField.id}
          open
          onOpenChange={(open) => !open && setEditingField(null)}
          field={editingField === "new" ? undefined : editingField}
          onSave={(draft) =>
            onFieldsChange(
              editingField === "new" ? [...drafts(), draft] : drafts().map((item) => (item.id === draft.id ? draft : item))
            )
          }
          onDelete={
            editingField === "new"
              ? undefined
              : () => onFieldsChange(drafts().filter((item) => item.id !== editingField.id))
          }
        />
      )}
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
              // Wide tables (many fields) scroll sideways; titles still wrap.
              <div id={panelId} className="overflow-x-auto border-t">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left">
                      <th className="min-w-64 px-4 py-2 font-medium whitespace-normal">Title</th>
                      <th className="min-w-28 px-4 py-2 font-medium whitespace-normal">Status</th>
                      {fields.map((field) => (
                        <th key={field.id} className="min-w-36 px-2 py-2 font-medium whitespace-normal">
                          {onFieldsChange ? (
                            <button
                              type="button"
                              onClick={() => setEditingField(field)}
                              title={`Edit ${field.name}`}
                              className="w-full rounded-sm px-2 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                            >
                              {field.name}
                            </button>
                          ) : (
                            <span className="px-2">{field.name}</span>
                          )}
                        </th>
                      ))}
                      <th className="w-16 px-2 py-2 font-medium">
                        {onFieldsChange ? (
                          <Button type="button" variant="ghost" size="icon-sm" aria-label="Add field" title="Add field" onClick={() => setEditingField("new")}>
                            <PlusIcon aria-hidden="true" />
                          </Button>
                        ) : (
                          <span className="sr-only">Delete</span>
                        )}
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
                          {fields.map((field) => (
                            <td key={field.id} className="px-2 py-2 align-top whitespace-normal break-words">
                              {onFieldValue ? (
                                <FieldCell
                                  field={field}
                                  value={ticket.field_values?.[field.id] ?? ""}
                                  users={users}
                                  ticketKey={ticket.key}
                                  onChange={(value) => onFieldValue(ticket.key, field, value)}
                                />
                              ) : (
                                <span className="px-2 text-muted-foreground">{ticket.field_values?.[field.id] || "—"}</span>
                              )}
                            </td>
                          ))}
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
