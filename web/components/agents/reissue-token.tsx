"use client"

import { useState } from "react"
import { toast } from "sonner"

import { KeyRoundIcon, RefreshCwIcon } from "@/components/icons"
import type { Agent } from "@/lib/types"
import { ConnectAgentError, reissueAgentToken, type ReissuedToken } from "@/lib/connect-agent"
import { mcpPublicUrl } from "@/lib/mcp-install"
import { CopyBlock, StepSection, formatWhen } from "@/components/connect/token-wizard"
import { McpInstallActions } from "@/components/mcp-install-actions"
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

/**
 * "New token" (expired) and "Reset token" (live or revoked) for your own agent or API key.
 * The board keeps the same agent, so its name, scopes and history carry over. The new secret
 * is shown once here; onIssued runs when the dialog closes so the row can update.
 */
export function ReissueTokenDialog({
  agent,
  name,
  kind,
  mode,
  onIssued,
}: {
  agent: Agent
  name: string
  kind: "agent" | "key"
  /** reissue: add a token (expired). reset: stop every old token, then add one (also restores a revoked agent). */
  mode: "reissue" | "reset"
  onIssued: (issued: ReissuedToken) => void
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [issued, setIssued] = useState<ReissuedToken | null>(null)
  const word = kind === "key" ? "key" : "token"
  const label = mode === "reset" ? `Reset ${word}` : `New ${word}`
  const restoring = mode === "reset" && agent.revoked

  async function confirm() {
    setBusy(true)
    try {
      setIssued(await reissueAgentToken(agent, mode === "reset"))
    } catch (error) {
      const message = error instanceof ConnectAgentError ? error.message : "Try again."
      toast.error(`Couldn't make ${name} a new ${word}`, { description: message })
    } finally {
      setBusy(false)
    }
  }

  function change(next: boolean) {
    setOpen(next)
    if (next || !issued) return
    // Hand the result over once, then forget the secret.
    onIssued(issued)
    setIssued(null)
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {mode === "reset" ? (
            <RefreshCwIcon className="size-4" aria-hidden="true" />
          ) : (
            <KeyRoundIcon className="size-4" aria-hidden="true" />
          )}
          {label}
        </Button>
      </DialogTrigger>
      {/* A stray click outside mustn't throw away a secret that is only shown once. */}
      <DialogContent className="sm:max-w-xl" onInteractOutside={(event) => issued && event.preventDefault()}>
        {issued ? (
          <>
            <DialogHeader>
              <DialogTitle>New {word} for {name}</DialogTitle>
              <DialogDescription>
                Copy it now. It can&apos;t be shown again once you close this.
                {issued.expiresAt && ` It expires ${formatWhen(issued.expiresAt)}.`}
              </DialogDescription>
            </DialogHeader>
            <div className="flex min-w-0 flex-col gap-4">
              <StepSection title={kind === "key" ? "API key" : "Token"}>
                <CopyBlock text={issued.secret} what={kind === "key" ? "API key" : "Token"} />
              </StepSection>
              {kind === "agent" && (
                <StepSection title="Client config">
                  <CopyBlock text={issued.install.json} what="MCP config" multiline />
                  <McpInstallActions install={issued.install} />
                  <p className="text-sm text-muted-foreground">
                    Swap it into your agent&apos;s config for {mcpPublicUrl()}. Nothing else changes.
                  </p>
                </StepSection>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button">Done</Button>
              </DialogClose>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {restoring ? `Bring back ${name}?` : mode === "reset" ? `Reset ${name}'s ${word}?` : `New ${word} for ${name}?`}
              </DialogTitle>
              <DialogDescription>
                {mode === "reset"
                  ? `Every ${word} it had stops working right away${restoring ? ", and it can act again with the new one" : ""}. `
                  : ""}
                Same {kind === "key" ? "key" : "agent"}, same name and scopes, and its history stays. You&apos;ll see the
                new {word} once.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="button" disabled={busy} onClick={() => void confirm()}>
                <KeyRoundIcon data-icon="inline-start" aria-hidden="true" />
                {busy ? "Generating…" : `Generate ${word}`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
