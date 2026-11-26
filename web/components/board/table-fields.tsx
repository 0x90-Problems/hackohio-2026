"use client"

// Typed table fields (NSB-94): the dialog that adds or changes one, and the cell that edits a
// ticket's value. Values are checked with the board's own rules (lib/table-fields.ts) before saving.

import { useState } from "react"
import { toast } from "sonner"

import { ExternalLinkIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  FIELD_TYPES,
  FIELD_TYPE_HINTS,
  FIELD_TYPE_LABELS,
  MAX_FIELD_NAME,
  checkFieldValue,
  daysUntil,
  type FieldDef,
  type FieldType,
} from "@/lib/table-fields"

/** Someone a Person field can name: the org's people from the board. */
export type Person = { _id: string; name: string }
import { cn } from "@/lib/utils"

export type FieldDraft = { id?: string; name: string; type: FieldType; options?: string[] }

const control =
  "h-8 w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 text-sm hover:border-border focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"

/** Add a field (no `field`), or rename, retype or delete one. */
export function FieldDialog({
  open,
  onOpenChange,
  field,
  onSave,
  onDelete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  field?: FieldDef
  onSave: (draft: FieldDraft) => Promise<boolean>
  onDelete?: () => Promise<boolean>
}) {
  const [name, setName] = useState(field?.name ?? "")
  const [type, setType] = useState<FieldType>(field?.type ?? FIELD_TYPES.TEXT)
  const [options, setOptions] = useState((field?.options ?? []).join("\n"))
  const [busy, setBusy] = useState(false)
  const optionList = options.split("\n").map((item) => item.trim()).filter(Boolean)
  const ready = name.trim().length > 0 && (type !== FIELD_TYPES.SELECT || optionList.length > 0)

  async function run(action: () => Promise<boolean>) {
    setBusy(true)
    const ok = await action()
    setBusy(false)
    if (ok) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (!ready || busy) return
            void run(() => onSave({ ...(field ? { id: field.id } : {}), name: name.trim(), type, ...(type === FIELD_TYPES.SELECT ? { options: optionList } : {}) }))
          }}
        >
          <DialogHeader>
            <DialogTitle>{field ? `Edit ${field.name}` : "Add a field"}</DialogTitle>
            <DialogDescription>
              {field ? "Changing the type keeps only values that still fit." : "A new column in this project's table. Agents can fill it in too."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="field-name">Name</Label>
            <Input id="field-name" value={name} maxLength={MAX_FIELD_NAME} autoFocus onChange={(event) => setName(event.target.value)} placeholder="Estimate" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="field-type">Type</Label>
            <select
              id="field-type"
              value={type}
              onChange={(event) => setType(event.target.value as FieldType)}
              className="h-9 rounded-md border bg-background px-2 text-sm focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {Object.values(FIELD_TYPES).map((value) => (
                <option key={value} value={value}>
                  {FIELD_TYPE_LABELS[value]}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{FIELD_TYPE_HINTS[type]}</p>
          </div>
          {type === FIELD_TYPES.SELECT && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="field-options">Options, one per line</Label>
              <Textarea id="field-options" rows={4} value={options} onChange={(event) => setOptions(event.target.value)} placeholder={"High\nMedium\nLow"} />
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            {field && onDelete ? (
              <Button type="button" variant="destructive" disabled={busy} onClick={() => void run(onDelete)}>
                Delete field
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!ready || busy}>
                {field ? "Save" : "Add field"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function today() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

/** "5 days left", "Today", "2 days overdue". */
export function countdownText(day: string, from = today()) {
  const days = daysUntil(day, from)
  if (days === 0) return "Today"
  if (days === 1) return "Tomorrow"
  if (days > 0) return `${days} days left`
  return days === -1 ? "1 day overdue" : `${-days} days overdue`
}

/** A ticket's value for one field, edited in place. */
export function FieldCell({
  field,
  value,
  users,
  ticketKey,
  onChange,
}: {
  field: FieldDef
  value: string
  users: Person[]
  ticketKey: string
  onChange: (value: string) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const label = `${field.name} for ${ticketKey}`
  const isPerson = (id: string) => users.some((user) => user._id === id)

  function commit(raw: string) {
    setDraft(null)
    let next: string
    try {
      next = checkFieldValue(field, raw, isPerson)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `That isn't a valid ${field.name}`)
      return
    }
    if (next !== value) onChange(next)
  }

  switch (field.type) {
    case FIELD_TYPES.CHECKBOX:
      return <Checkbox aria-label={label} checked={value === "true"} onCheckedChange={(checked) => onChange(checked === true ? "true" : "")} />
    case FIELD_TYPES.PERSON:
    case FIELD_TYPES.SELECT: {
      const choices = field.type === FIELD_TYPES.PERSON ? users.map((user) => ({ value: user._id, label: user.name })) : (field.options ?? []).map((option) => ({ value: option, label: option }))
      return (
        <select aria-label={label} value={value} onChange={(event) => commit(event.target.value)} className={cn(control, !value && "text-muted-foreground")}>
          <option value="">—</option>
          {value && !choices.some((choice) => choice.value === value) ? <option value={value}>{value}</option> : null}
          {choices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      )
    }
    case FIELD_TYPES.DATE:
    case FIELD_TYPES.COUNTDOWN: {
      const days = value ? daysUntil(value, today()) : null
      return (
        <div className="flex min-w-0 flex-col gap-0.5">
          <input type="date" aria-label={label} value={value} onChange={(event) => commit(event.target.value)} className={cn(control, !value && "text-muted-foreground")} />
          {field.type === FIELD_TYPES.COUNTDOWN && value && days !== null ? (
            <span className={cn("px-2 text-xs", days < 0 ? "font-medium text-foreground" : "text-muted-foreground")} data-slot="countdown">
              {countdownText(value)}
            </span>
          ) : null}
        </div>
      )
    }
    default: {
      const shown = draft ?? value
      return (
        <div className="flex min-w-0 items-center gap-1">
          <input
            type="text"
            inputMode={field.type === FIELD_TYPES.NUMBER ? "decimal" : field.type === FIELD_TYPES.LINK ? "url" : "text"}
            aria-label={label}
            value={shown}
            placeholder="—"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => draft !== null && commit(draft)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur()
              if (event.key === "Escape") {
                setDraft(null)
                event.currentTarget.blur()
              }
            }}
            className={cn(control, field.type === FIELD_TYPES.NUMBER && "tabular-nums", "placeholder:text-muted-foreground")}
          />
          {field.type === FIELD_TYPES.LINK && value && draft === null ? (
            <a href={value} target="_blank" rel="noopener noreferrer" aria-label={`Open ${field.name}`} className="shrink-0 rounded-sm p-1 text-muted-foreground hover:text-foreground">
              <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
            </a>
          ) : null}
        </div>
      )
    }
  }
}
