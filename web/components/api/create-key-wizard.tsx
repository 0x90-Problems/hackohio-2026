"use client"

// "Create API key" (/api/keys/new, NSB-66 and NSB-68): what it may do, name and expiry,
// key once, use it, summary. REST only: AI agents connect over MCP on the Agents page instead.
// Same board call as before (connectAgent with the API key connection).

import Link from "next/link"
import { ArrowRightIcon } from "@/components/icons"

import { AGENT_CONNECTION, SCOPES, TOKEN_PREFIX } from "@/shared/names"
import { useAuthUser } from "@/components/auth/auth-gate"
import { ConnectAgentError, connectAgent } from "@/lib/connect-agent"
import { boardApiPublicUrl, curlExample, restTestCall } from "@/lib/rest-api"
import { withReturn } from "@/lib/return-path"
import { Button } from "@/components/ui/button"
import {
  CopyBlock,
  ScopeList,
  StepSection,
  SummaryRow,
  TokenWizard,
  formatWhen,
} from "@/components/connect/token-wizard"
import { useTokenSetup } from "@/components/connect/use-token-setup"

export const KEY_WIZARD_STEPS = ["What it may do", "Name and expiry", "Key", "Use it", "Summary"] as const

/** The one line a script or CI job needs. It holds the key, so it is shown only on this page. */
export function apiKeyEnvLine(secret: string): string {
  return `NUTSHELL_API_KEY=${secret}`
}

export function CreateKeyWizard({ returnTo, returnLabel }: { returnTo: string; returnLabel: string }) {
  const account = useAuthUser()
  const setup = useTokenSetup()
  const baseUrl = boardApiPublicUrl()

  return (
    <TokenWizard<null>
      title="Create API key"
      description="For scripts, CI jobs, and integrations that call the REST API."
      stepLabels={KEY_WIZARD_STEPS}
      secretWord="API key"
      createLabel="Create API key"
      pendingLabel="Creating…"
      defaultScopes={[SCOPES.TICKETS_READ]}
      nameLabel="Name"
      namePlaceholder="e.g. Nightly report script"
      expiryHours={setup.expiryHours}
      idPrefix="key"
      disabled={!account}
      returnTo={returnTo}
      returnLabel={returnLabel}
      create={async (name, scopes) => {
        if (!account) throw new ConnectAgentError("Sign in before creating a key")
        try {
          // The board API stores the key; the API page lists it from there.
          const connected = await connectAgent({
            name,
            ownerId: account._id,
            username: account.auth_username,
            scopes,
            connection: AGENT_CONNECTION.API_KEY,
          })
          // MCP install links are not used here: an API key is for the REST API.
          return { secret: connected.secret, extra: null }
        } catch (error) {
          throw error instanceof ConnectAgentError ? error : new Error("Couldn't create the key")
        }
      }}
      renderUse={() => (
        <>
          <StepSection title="Base URL">
            <CopyBlock text={baseUrl} what="Base URL" />
          </StepSection>
          <StepSection title="Authorization header">
            <code className="rounded-lg border p-3 font-mono text-xs">Authorization: Bearer {TOKEN_PREFIX}…</code>
            <p className="text-sm text-muted-foreground">
              Store the key as a secret in your script or CI, and put it in{" "}
              <code className="font-mono">NUTSHELL_API_KEY</code> so it stays out of your shell history and logs.
            </p>
          </StepSection>
          <StepSection title="Example">
            <CopyBlock text={curlExample(baseUrl)} what="curl example" />
          </StepSection>
          <StepSection title="Test call">
            <CopyBlock text={restTestCall(baseUrl)} what="test call" />
            <p className="text-sm text-muted-foreground">
              Prints <code className="font-mono">200</code> when the key works. <code className="font-mono">401</code>{" "}
              means it is wrong, expired, or revoked. <code className="font-mono">403</code> means it lacks{" "}
              <code className="font-mono">{SCOPES.TICKETS_READ}</code>.
            </p>
          </StepSection>
        </>
      )}
      renderSummary={(issued, summary, markCopied) => (
        <>
          <dl className="flex flex-col">
            <SummaryRow label="API key">
              <span className="font-medium">{summary.name}</span>
              {account && <span className="text-muted-foreground"> · created by {account.name}</span>}
            </SummaryRow>
            <SummaryRow label="Calls">The REST API, at {baseUrl}</SummaryRow>
            <SummaryRow label="May">
              <ScopeList scopes={summary.scopes} />
            </SummaryRow>
            {setup.org && <SummaryRow label="Organization">{setup.org}</SummaryRow>}
            {setup.team && <SummaryRow label="Team">{setup.team}</SummaryRow>}
            <SummaryRow label="Key expires">
              <time dateTime={summary.expiresAt.toISOString()}>{formatWhen(summary.expiresAt)}</time>
            </SummaryRow>
          </dl>
          <StepSection title="Secret for your script or CI (shown once)">
            <CopyBlock text={apiKeyEnvLine(issued.secret)} what="NUTSHELL_API_KEY line" onCopied={markCopied} />
            <p className="text-sm text-muted-foreground">
              Add it to your CI secrets or a local <code className="font-mono">.env</code> file that is never
              committed. Once you leave this page it can&apos;t be shown again: revoke the key and create a new one
              instead.
            </p>
          </StepSection>
        </>
      )}
      lastFooter={
        <Button variant="outline" asChild>
          <Link href={withReturn("/agents/connect", returnTo)}>
            <ArrowRightIcon data-icon="inline-start" aria-hidden="true" />
            For an AI agent, connect it over MCP
          </Link>
        </Button>
      }
    />
  )
}
