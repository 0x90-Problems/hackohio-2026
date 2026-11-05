"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  ActivityIcon,
  BotIcon,
  ClockIcon,
  CopyIcon,
  ShieldOffIcon,
  WifiOffIcon,
} from "@/components/icons"
import { toast } from "sonner"

import {
  ACTOR_TYPES,
  AGENT_CONNECTION,
  DEFAULT_TOKEN_EXPIRY_HOURS,
} from "@/shared/names"
import type { Agent } from "@/lib/types"
import { getUser } from "@/lib/mock-data"
import { agentAccess, type AgentUsage } from "@/lib/agent-usage"
import { useAuthUser } from "@/components/auth/auth-gate"
import { CleanupInactiveButton, DeleteAgentDialog } from "@/components/agents/delete-agent"
import { ConnectAgentWizard } from "@/components/agents/connect-agent-wizard"
import { loadSite } from "@/lib/site-db"
import { mergeAgentRecords, visibleAgentName } from "@/lib/agent-label"
import { loadBoard, saveAgent } from "@/lib/board-db"
import { canDeleteAgent } from "@/lib/delete-agent"
import { ConnectAgentError, listBoardAgents, listBoardUsers, revokeAgentAccess } from "@/lib/connect-agent"
import { timeAgo } from "@/lib/format"
import { mcpPublicUrl } from "@/lib/mcp-install"
import { groupTools, type McpToolCatalog } from "@/lib/mcp-tools"
import { onlyConnection } from "@/lib/rest-api"
import mcpToolCatalog from "@/shared/mcp-tools.json"
import { cn } from "@/lib/utils"
import { ActorBadge, HumanAvatar } from "@/components/actor-badge"
import { ScopeBadge } from "@/components/scope-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// Tools a client sees from the gateway's tools/list, in the backend's own words.
const TOOL_AREAS = groupTools(mcpToolCatalog as McpToolCatalog)
const TOOL_COUNT = TOOL_AREAS.reduce((total, area) => total + area.tools.length, 0)

export function AgentsView() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [people, setPeople] = useState<{ _id: string; name: string }[]>([])
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  // Last use and expiry per agent, derived by the board API from all of its tokens.
  const [usage, setUsage] = useState<Map<string, AgentUsage>>(new Map())
  // The organization's token expiry, shown in the Connect agent wizard.
  const [expiryHours, setExpiryHours] = useState(DEFAULT_TOKEN_EXPIRY_HOURS)

  useEffect(() => {
    let cancelled = false
    loadSite()
      .then((site) => {
        const hours = site.organization?.token_expiry_hours
        if (!cancelled && hours) setExpiryHours(hours)
      })
      .catch(() => {
        // Keeps the default expiry.
      })
    listBoardUsers()
      .then((users) => {
        if (!cancelled) setPeople(users)
      })
      .catch(() => {
        // Owner names fall back to the signed-in person and the sample directory.
      })
    Promise.all([
      loadBoard().catch(() => null),
      listBoardAgents().catch(() => []),
    ])
      .then(([board, live]) => {
        if (cancelled) return
        const saved = board?.agents ?? []
        setUsage(new Map(live.map((agent) => [agent._id, agent])))
        // Empty DocDB stays empty — do not push mock demo agents back into the board.
        // API keys are listed on the API page, so only MCP agents show here.
        setAgents(onlyConnection(mergeAgentRecords(saved, live), AGENT_CONNECTION.MCP, AGENT_CONNECTION.MCP))
      })
      .catch(() => {
        setAgents([])
        toast.error("Couldn't load agents from the database")
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function revoke(agent: Agent) {
    try {
      await revokeAgentAccess(agent._id)
    } catch (error) {
      const message = error instanceof ConnectAgentError ? error.message : "Couldn't revoke that agent"
      if (!message.includes("was not found") && !message.includes("Sign in again")) {
        toast.error(message)
        return
      }
      if (message.includes("Sign in again")) {
        toast.error(message)
        return
      }
    }
    const next = { ...agent, revoked: true }
    setAgents((current) => current.map((a) => (a._id === agent._id ? next : a)))
    saveAgent(next)
    toast.success(`Revoked ${visibleAgentName(agent.name, agent._id)}`, { description: "Its token stopped working." })
  }

  // Deleted on the board: drop the rows. Their history keeps the stored names.
  function forget(agentIds: string[]) {
    const gone = new Set(agentIds)
    setAgents((current) => current.filter((agent) => !gone.has(agent._id)))
  }

  function connect(agent: Agent) {
    setAgents((current) => [agent, ...current])
    setNewIds((ids) => new Set(ids).add(agent._id))
    saveAgent(agent)
  }

  return (
    <main className="mx-auto flex max-w-screen-xl flex-col gap-6 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
            <BotIcon className="size-6" aria-hidden="true" />
            Agents
          </h1>
          <p className="text-muted-foreground">
            AI agents connect over MCP. Every agent belongs to a person. Revoke one and its token stops
            working right away. Scripting the board instead? Use the{" "}
            <Link href="/api" className="font-medium text-foreground underline underline-offset-4">
              API (REST)
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CleanupInactiveButton
            connection={AGENT_CONNECTION.MCP}
            missing={AGENT_CONNECTION.MCP}
            words={{ one: "agent", many: "agents", otherOne: "API key", otherMany: "API keys", otherPage: "API page" }}
            onDeleted={forget}
          />
          <ConnectAgentWizard expiryHours={expiryHours} onConnect={connect} />
        </div>
      </div>

      <div className="grid items-start gap-6">
        <div className="flex min-w-0 flex-col gap-6">
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Agent</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>
                    <span className="inline-flex items-center gap-1.5">
                      <ActivityIcon className="size-4" aria-hidden="true" />
                      Last active
                    </span>
                  </TableHead>
                  <TableHead className="pr-4 text-right">Access</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent) => (
                  <AgentRow
                    key={agent._id}
                    agent={agent}
                    isNew={newIds.has(agent._id)}
                    people={people}
                    usage={usage.get(agent._id)}
                    onRevoke={revoke}
                    onDeleted={(id) => forget([id])}
                  />
                ))}
              </TableBody>
            </Table>
          </Card>

          <McpGatewayCard />
        </div>
      </div>
    </main>
  )
}

function AgentRow({
  agent,
  isNew,
  people,
  usage,
  onRevoke,
  onDeleted,
}: {
  agent: Agent
  isNew: boolean
  people: { _id: string; name: string }[]
  usage?: AgentUsage
  onRevoke: (agent: Agent) => void
  onDeleted: (agentId: string) => void
}) {
  const account = useAuthUser()
  const ownerName =
    people.find((person) => person._id === agent.owner_id)?.name ??
    getUser(agent.owner_id)?.name ??
    (account?._id === agent.owner_id ? account.name : undefined)
  const active = usage?.last_used_at ?? null
  // An expired agent can't act any more, so it reads like a revoked one.
  const access = agentAccess(agent, usage)
  const inactive = access !== "active"
  const deletable = canDeleteAgent(agent.owner_id, account?._id, account?.admin === true)
  return (
    <TableRow
      className={cn(
        inactive && "text-muted-foreground",
        isNew && "duration-300 animate-in fade-in slide-in-from-top-2"
      )}
    >
      <TableCell className="pl-4">
        <div className={cn("flex flex-col gap-1", inactive && "opacity-60")}>
          <ActorBadge
            actor={{ type: ACTOR_TYPES.AGENT, id: agent._id, name: agent.name, acting_for: agent.owner_id }}
          />
        </div>
      </TableCell>
      <TableCell>
        {ownerName ? (
          <span className="inline-flex items-center gap-1.5">
            <HumanAvatar name={ownerName} /> {ownerName}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Unknown owner</span>
        )}
      </TableCell>
      <TableCell>
        <div className={cn("flex flex-col items-start gap-1", inactive && "opacity-60")}>
          {agent.scopes.map((scope) => (
            <ScopeBadge key={scope} scope={scope} />
          ))}
        </div>
      </TableCell>
      <TableCell className="tabular-nums">
        {active ? timeAgo(active) : <span className="text-muted-foreground">Never</span>}
      </TableCell>
      <TableCell className="pr-4 text-right">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {access === "revoked" ? (
            <Badge variant="outline">
              <WifiOffIcon className="size-3" aria-hidden="true" />
              Revoked
            </Badge>
          ) : access === "expired" ? (
            <Badge variant="outline">
              <ClockIcon className="size-3" aria-hidden="true" />
              Expired
            </Badge>
          ) : account?._id === agent.owner_id ? (
            <RevokeDialog agent={agent} ownerName={ownerName} onRevoke={onRevoke} />
          ) : (
            <span className="text-sm text-muted-foreground">Active</span>
          )}
          {deletable && (
            <DeleteAgentDialog
              agentId={agent._id}
              name={visibleAgentName(agent.name, agent._id)}
              kind="agent"
              ownerName={ownerName}
              onDeleted={onDeleted}
            />
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}

function RevokeDialog({
  agent,
  ownerName,
  onRevoke,
}: {
  agent: Agent
  ownerName?: string
  onRevoke: (agent: Agent) => void
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <ShieldOffIcon className="size-4" aria-hidden="true" />
          Revoke
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Revoke {visibleAgentName(agent.name, agent._id)}
            {ownerName && ` for ${ownerName}`}?
          </DialogTitle>
          <DialogDescription>
            Its token stops working right away. Anything it&apos;s doing now will fail.
            To use this agent again, generate a new token.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="destructive" onClick={() => onRevoke(agent)}>
              <ShieldOffIcon className="size-4" aria-hidden="true" />
              Revoke
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function McpGatewayCard() {
  const url = mcpPublicUrl()
  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      toast.success("MCP URL copied")
    } catch {
      toast.error("Couldn't copy", { description: "Select the URL and copy it by hand." })
    }
  }
  return (
    <Card id="mcp">
      <CardHeader>
        <CardTitle className="text-lg">MCP gateway</CardTitle>
        <CardDescription>
          Streamable HTTP. Your agent sends its token as <code className="font-mono">Authorization: Bearer …</code>.
          The install config comes with the token in <span className="font-medium">Connect agent</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-center gap-2 rounded-lg bg-foreground p-3 text-background">
          <code className="min-w-0 flex-1 font-mono text-xs break-all">{url}</code>
          <Button
            size="icon-sm"
            variant="ghost"
            className="shrink-0 text-background hover:bg-background/15 hover:text-background"
            onClick={copy}
            aria-label="Copy MCP URL"
          >
            <CopyIcon aria-hidden="true" />
          </Button>
        </div>
        <div className="flex flex-col gap-4">
          <h3 className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
            Tools your agent gets · {TOOL_COUNT}
          </h3>
          {TOOL_AREAS.map((area) => (
            <section key={area.id} aria-labelledby={`tools-${area.id}`} className="flex flex-col gap-1.5">
              <h4 id={`tools-${area.id}`} className="text-sm font-semibold">
                {area.label}
              </h4>
              <ul className="flex flex-col divide-y rounded-lg border">
                {area.tools.map((tool) => (
                  <li key={tool.name} className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:items-baseline sm:gap-3">
                    <code className="shrink-0 font-mono text-xs font-semibold sm:w-48">{tool.name}</code>
                    <span className="text-sm text-muted-foreground">{tool.description}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <p className="text-xs text-muted-foreground">
            Each tool also needs its scope on the token. Without it the call is refused.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
