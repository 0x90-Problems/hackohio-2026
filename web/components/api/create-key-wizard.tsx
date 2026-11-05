"use client"

// "Create API key" on the API page (NSB-66): what it may do, name and expiry, key once,
// use it. REST only: AI agents connect over MCP on the Agents page instead.
// Same board call as before (connectAgent with the API key connection).

import Link from "next/link"
import { ArrowRightIcon } from "@/components/icons"

import { AGENT_CONNECTION, SCOPES, TOKEN_PREFIX, type Scope } from "@/shared/names"
import { useAuthUser } from "@/components/auth/auth-gate"
import { ConnectAgentError, connectAgent } from "@/lib/connect-agent"
import { curlExample, restTestCall } from "@/lib/rest-api"
import { Button } from "@/components/ui/button"
import { CopyBlock, StepSection, TokenWizard } from "@/components/connect/token-wizard"

export const KEY_WIZARD_STEPS = ["What it may do", "Name and expiry", "Key", "Use it"] as const

export type CreatedKey = {
  id: string
  name: string
  owner_id: string
  token_prefix: string
  last_used_at: null
  scopes: Scope[]
}

export function CreateKeyWizard({
  baseUrl,
  expiryHours,
  onCreate,
}: {
  baseUrl: string
  expiryHours: number
  onCreate: (key: CreatedKey) => void
}) {
  const account = useAuthUser()

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
      expiryHours={expiryHours}
      idPrefix="key"
      disabled={!account}
      triggerClassName="w-full"
      create={async (name, scopes) => {
        if (!account) throw new ConnectAgentError("Sign in before creating a key")
        try {
          const connected = await connectAgent({
            name,
            ownerId: account._id,
            username: account.auth_username,
            scopes,
            connection: AGENT_CONNECTION.API_KEY,
          })
          onCreate({
            id: connected.agent._id,
            name: connected.agent.name,
            owner_id: connected.agent.owner_id,
            token_prefix: connected.secret.slice(0, 10),
            last_used_at: null,
            scopes: connected.agent.scopes,
          })
          // MCP install links are not used here: an API key is for the REST API.
          return { secret: connected.secret, extra: null }
        } catch (error) {
          throw error instanceof ConnectAgentError ? error : new Error("Couldn't create the key")
        }
      }}
      renderLast={() => (
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
      lastFooter={
        <Button variant="outline" asChild>
          <Link href="/agents">
            <ArrowRightIcon data-icon="inline-start" aria-hidden="true" />
            For an AI agent, use Agents (MCP)
          </Link>
        </Button>
      }
    />
  )
}
