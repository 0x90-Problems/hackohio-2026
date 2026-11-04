"use client"

import { useState } from "react"
import { toast } from "sonner"

import { BrushCleaningIcon, Trash2Icon } from "@/components/icons"
import { ConnectAgentError, cleanupInactiveAgents, deleteAgent } from "@/lib/connect-agent"
import { cleanupCount, deleteSummary, plural, splitCleanup, type AgentCleanup, type CleanupWords } from "@/lib/delete-agent"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

const explain = (error: unknown, fallback: string) => (error instanceof ConnectAgentError ? error.message : fallback)

// Deletes one agent or API key for good. Shown to its owner and org admins.
// Used by the Agents page (MCP agents) and the API page (API keys).
export function DeleteAgentDialog({
  agentId,
  name,
  kind,
  ownerName,
  onDeleted,
}: {
  agentId: string
  name: string
  kind: "agent" | "key"
  ownerName?: string
  onDeleted: (agentId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function confirm() {
    setBusy(true)
    try {
      // Null means it was already gone; either way it leaves the list.
      await deleteAgent(agentId)
      setOpen(false)
      onDeleted(agentId)
      toast.success(`Deleted ${name}`)
    } catch (error) {
      toast.error(`Couldn't delete ${name}`, { description: explain(error, "Try again.") })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2Icon className="size-4" aria-hidden="true" />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Delete {name}
            {ownerName && ` for ${ownerName}`}?
          </DialogTitle>
          <DialogDescription>{deleteSummary(name, kind)}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" disabled={busy} onClick={() => void confirm()}>
            <Trash2Icon data-icon="inline-start" aria-hidden="true" />
            {busy ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type Words = CleanupWords & { otherPage: string }

// "Clean up inactive": a dry run first, so the dialog names exactly what goes, then the real run.
// The board cleans up the caller's own agents of both kinds at once, so the dialog lists this
// page's kind first and then says what else goes from the other page.
export function CleanupInactiveButton({
  connection,
  missing,
  words,
  onDeleted,
}: {
  connection: string
  missing: string
  words: Words
  onDeleted: (agentIds: string[]) => void
}) {
  const [preview, setPreview] = useState<AgentCleanup | null>(null)
  const [checking, setChecking] = useState(false)
  const [busy, setBusy] = useState(false)
  const { here, elsewhere } = splitCleanup(preview?.agents ?? [], connection, missing)

  async function check() {
    setChecking(true)
    try {
      const found = await cleanupInactiveAgents(true)
      if (found.agents.length === 0) {
        toast("Nothing to clean up", { description: `None of your ${words.many} or ${words.otherMany} are inactive.` })
        return
      }
      setPreview(found)
    } catch (error) {
      toast.error("Couldn't check for inactive ones", { description: explain(error, "Try again.") })
    } finally {
      setChecking(false)
    }
  }

  async function confirm() {
    setBusy(true)
    try {
      const done = await cleanupInactiveAgents(false)
      setPreview(null)
      onDeleted(done.agents.map((agent) => agent.agent_id))
      const split = splitCleanup(done.agents, connection, missing)
      toast.success(`Deleted ${cleanupCount(split.here.length, split.elsewhere.length, words)}`)
    } catch (error) {
      toast.error("Couldn't clean up", { description: explain(error, "Try again.") })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" disabled={checking} onClick={() => void check()}>
        <BrushCleaningIcon data-icon="inline-start" aria-hidden="true" />
        {checking ? "Checking…" : "Clean up inactive"}
      </Button>
      <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {cleanupCount(here.length, elsewhere.length, words)}?</DialogTitle>
            <DialogDescription>
              Your inactive ones: revoked, or every token revoked or expired. They&apos;re gone for good. Their
              tokens stop working, and their past comments and tickets stay, with their names.
            </DialogDescription>
          </DialogHeader>
          <div className="flex max-h-64 flex-col gap-3 overflow-y-auto text-sm">
            {here.length > 0 && <NameList title={words.many} rows={here} />}
            {elsewhere.length > 0 && (
              <NameList title={`Also ${plural(elsewhere.length, words.otherOne, words.otherMany)} from the ${words.otherPage}`} rows={elsewhere} />
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" variant="destructive" disabled={busy} onClick={() => void confirm()}>
              <Trash2Icon data-icon="inline-start" aria-hidden="true" />
              {busy ? "Deleting…" : `Delete ${preview?.agents.length ?? 0}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function NameList({ title, rows }: { title: string; rows: { agent_id: string; name: string }[] }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="font-mono text-xs tracking-widest text-muted-foreground uppercase">{title}</h3>
      <ul className="flex flex-col divide-y rounded-lg border">
        {rows.map((row) => (
          <li key={row.agent_id} className="truncate px-3 py-1.5">
            {row.name || row.agent_id}
          </li>
        ))}
      </ul>
    </section>
  )
}
