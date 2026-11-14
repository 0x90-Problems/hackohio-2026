"use client"

// "Connect agent" (/agents/connect, NSB-66 and NSB-68): what it may do, name, token once,
// install, summary. Same board call as before (connectAgent with the MCP connection).

import { AGENT_CONNECTION, SCOPES } from "@/shared/names"
import { useAuthUser } from "@/components/auth/auth-gate"
import { AgentTag } from "@/components/actor-badge"
import { saveAgent } from "@/lib/board-db"
import { ConnectAgentError, connectAgent } from "@/lib/connect-agent"
import { mcpPublicUrl, mcpTestCall, type McpInstallLinks } from "@/lib/mcp-install"
import { McpInstallActions } from "@/components/mcp-install-actions"
import {
  CopyBlock,
  ScopeList,
  StepSection,
  SummaryRow,
  TokenWizard,
  formatWhen,
} from "@/components/connect/token-wizard"
import { useTokenSetup } from "@/components/connect/use-token-setup"

export const AGENT_WIZARD_STEPS = ["What it may do", "Name", "Token", "Install", "Summary"] as const

export function ConnectAgentWizard({ returnTo, returnLabel }: { returnTo: string; returnLabel: string }) {
  const account = useAuthUser()
  const setup = useTokenSetup()
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
      expiryHours={setup.expiryHours}
      idPrefix="agent"
      disabled={!account}
      returnTo={returnTo}
      returnLabel={returnLabel}
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
          saveAgent(connected.agent)
          return { secret: connected.secret, extra: connected.install }
        } catch (error) {
          throw error instanceof ConnectAgentError ? error : new Error("Couldn't connect that agent")
        }
      }}
      renderUse={(issued, markCopied) => (
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
      renderSummary={(issued, summary, markCopied) => (
        <>
          <dl className="flex flex-col">
            <SummaryRow label="Agent">
              <span className="flex flex-wrap items-center gap-2">
                <AgentTag />
                <span className="font-medium">{summary.name}</span>
                {account && <span className="text-muted-foreground">for {account.name}</span>}
              </span>
            </SummaryRow>
            <SummaryRow label="Connects over">MCP, at {url}</SummaryRow>
            <SummaryRow label="May">
              <ScopeList scopes={summary.scopes} />
            </SummaryRow>
            {setup.org && <SummaryRow label="Organization">{setup.org}</SummaryRow>}
            {setup.team && <SummaryRow label="Team">{setup.team}</SummaryRow>}
            <SummaryRow label="Token expires">
              <time dateTime={summary.expiresAt.toISOString()}>{formatWhen(summary.expiresAt)}</time>
            </SummaryRow>
          </dl>
          <StepSection title="Client config (shown once)">
            <CopyBlock text={issued.extra.json} what="MCP config" multiline onCopied={markCopied} />
            <p className="text-sm text-muted-foreground">
              It holds the token. Once you leave this page it can&apos;t be shown again: revoke the agent and
              connect a new one instead.
            </p>
          </StepSection>
        </>
      )}
    />
  )
}
