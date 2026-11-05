"use client"

// "Connect agent" on the Agents page (NSB-66): what it may do, name, token once, install.
// Same board call as before (connectAgent with the MCP connection).

import { AGENT_CONNECTION, SCOPES } from "@/shared/names"
import type { Agent } from "@/lib/types"
import { useAuthUser } from "@/components/auth/auth-gate"
import { ConnectAgentError, connectAgent } from "@/lib/connect-agent"
import { mcpPublicUrl, mcpTestCall, type McpInstallLinks } from "@/lib/mcp-install"
import { McpInstallActions } from "@/components/mcp-install-actions"
import { CopyBlock, StepSection, TokenWizard } from "@/components/connect/token-wizard"

export const AGENT_WIZARD_STEPS = ["What it may do", "Name", "Token", "Install"] as const

export function ConnectAgentWizard({
  expiryHours,
  onConnect,
}: {
  expiryHours: number
  onConnect: (agent: Agent) => void
}) {
  const account = useAuthUser()
  const url = mcpPublicUrl()

  return (
    <TokenWizard<McpInstallLinks>
      title="Connect agent"
      description="Bring your own AI agent. It connects over MCP and acts for you."
      stepLabels={AGENT_WIZARD_STEPS}
      secretWord="token"
      createLabel="Generate token"
      pendingLabel="Connecting…"
      defaultScopes={[SCOPES.TICKETS_READ, SCOPES.TICKETS_WRITE, SCOPES.COMMENTS_WRITE]}
      nameLabel="Name it"
      namePlaceholder={account ? `e.g. ${account.name}'s coding agent` : "e.g. your agent"}
      expiryHours={expiryHours}
      idPrefix="agent"
      disabled={!account}
      create={async (name, scopes) => {
        if (!account) throw new ConnectAgentError("Sign in before connecting an agent")
        try {
          const connected = await connectAgent({
            name,
            ownerId: account._id,
            username: account.auth_username,
            scopes,
            connection: AGENT_CONNECTION.MCP,
          })
          onConnect(connected.agent)
          return { secret: connected.secret, extra: connected.install }
        } catch (error) {
          throw error instanceof ConnectAgentError ? error : new Error("Couldn't connect that agent")
        }
      }}
      renderLast={(issued, markCopied) => (
        <>
          <StepSection title="MCP gateway">
            <CopyBlock text={url} what="MCP URL" />
            <p className="text-sm text-muted-foreground">
              Streamable HTTP. Your agent sends the token as{" "}
              <code className="font-mono">Authorization: Bearer …</code>.
            </p>
          </StepSection>
          <StepSection title="Client config">
            {/* The config holds the token, so copying it counts as copying the token. */}
            <CopyBlock text={issued.extra.json} what="MCP config" multiline onCopied={markCopied} />
            <McpInstallActions install={issued.extra} />
          </StepSection>
          <StepSection title="Test call">
            <CopyBlock text={mcpTestCall(url)} what="test call" />
            <p className="text-sm text-muted-foreground">
              Put the token in <code className="font-mono">NUTSHELL_MCP_TOKEN</code> first. The answer lists
              the tools this token may use. <code className="font-mono">401</code> means the token is wrong,
              expired, or revoked.
            </p>
          </StepSection>
        </>
      )}
    />
  )
}
