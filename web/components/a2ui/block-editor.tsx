"use client"

import { useMemo, useState } from "react"

import { A2uiBlockView } from "@/components/a2ui/a2ui-block-view"
import { LayoutTemplateIcon, XIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { BlockError, checkBlock, type A2uiBlock } from "@/lib/a2ui-block"
import { BLOCK_TEMPLATES, templateJson } from "@/lib/a2ui-templates"

/** The JSON in the editor, checked the same way the board checks it. */
function parse(json: string): { block: A2uiBlock | null; error: string } {
  if (!json.trim()) return { block: null, error: "" }
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch (caught) {
    return { block: null, error: `Not valid JSON: ${caught instanceof Error ? caught.message : "check commas and quotes"}` }
  }
  try {
    return { block: checkBlock(raw), error: "" }
  } catch (caught) {
    return { block: null, error: caught instanceof BlockError ? caught.message : "This block can't be used." }
  }
}

/** "Add a block" in the comment box (NSB-90): pick a template, edit it, see it, attach it. */
export function BlockEditorButton({ block, onSave }: { block: A2uiBlock | null; onSave: (block: A2uiBlock) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" variant="ghost" size="icon-sm" aria-label={block ? "Edit the block" : "Add a block"} title={block ? "Edit the block" : "Add a block"} onClick={() => setOpen(true)}>
        <LayoutTemplateIcon aria-hidden="true" />
      </Button>
      {open && (
        <BlockEditorDialog
          initial={block ? JSON.stringify(block, null, 2) : templateJson(BLOCK_TEMPLATES[0])}
          onClose={() => setOpen(false)}
          onSave={(next) => {
            onSave(next)
            setOpen(false)
          }}
        />
      )}
    </>
  )
}

function BlockEditorDialog({ initial, onClose, onSave }: { initial: string; onClose: () => void; onSave: (block: A2uiBlock) => void }) {
  const [json, setJson] = useState(initial)
  const { block, error } = useMemo(() => parse(json), [json])
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Add a block</DialogTitle>
          <DialogDescription>
            Start from a template, then edit the JSON. It shows under your comment&apos;s text. Allowed: text, cards, rows and columns,
            lists, tabs, pop-ups, icons, NutShell images and link buttons.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Templates">
          {BLOCK_TEMPLATES.map((template) => (
            <Button key={template.id} type="button" size="sm" variant="outline" title={template.description} onClick={() => setJson(templateJson(template))}>
              {template.name}
            </Button>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="block-json">Block (A2UI JSON)</Label>
            <Textarea
              id="block-json"
              value={json}
              onChange={(event) => setJson(event.target.value)}
              spellCheck={false}
              className="min-h-80 font-mono text-xs"
              aria-invalid={Boolean(error)}
              aria-describedby="block-error"
            />
            <p id="block-error" role="status" className={error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
              {error || (block ? `Looks good: ${block.components.length} components.` : "")}
            </p>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <span className="text-sm font-medium">Preview</span>
            <div className="min-h-80 rounded-lg border bg-muted/20 p-4">
              {block ? <A2uiBlockView block={block} /> : <p className="text-sm text-muted-foreground">Fix the JSON to see the preview.</p>}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={!block} onClick={() => block && onSave(block)}>
            Attach block
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** The block waiting to go with the comment, with edit and remove. */
export function BlockDraft({ block, onEdit, onRemove }: { block: A2uiBlock; onEdit: (block: A2uiBlock) => void; onRemove: () => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Block attached ({block.components.length} components)</span>
        <span className="flex items-center gap-1">
          <BlockEditorButton block={block} onSave={onEdit} />
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove the block" title="Remove the block" onClick={onRemove}>
            <XIcon aria-hidden="true" />
          </Button>
        </span>
      </div>
      <A2uiBlockView block={block} />
    </div>
  )
}
