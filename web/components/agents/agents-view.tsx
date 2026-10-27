"use client"

import { useEffect, useState } from "react"
import {
  AlertTriangleIcon,
  ActivityIcon,
  BotIcon,
  CopyIcon,
  KeyRoundIcon,
  ShieldOffIcon,
  WifiOffIcon,
  WifiIcon,
} from "@/components/icons"
import { toast } from "sonner"

import {
  ACTOR_TYPES,
  AGENT_CONNECTION,
  DEFAULT_TOKEN_EXPIRY_HOURS,
  SCOPES,
  type Scope,
} from "@/shared/names"
import type { Agent } from "@/lib/types"
import {
  agentTokens,
  getUser,
} from "@/lib/mock-data"
import { useAuthUser } from "@/components/auth/auth-gate"
import { McpInstallActions } from "@/components/mcp-install-actions"
import { mergeAgentRecords, visibleAgentName } from "@/lib/agent-label"
import { loadBoard, saveAgent } from "@/lib/board-db"
import { ConnectAgentError, connectAgent, listBoardAgents, listBoardUsers, revokeAgentAccess } from "@/lib/connect-agent"
import { timeAgo } from "@/lib/format"
import type { McpInstallLinks } from "@/lib/mcp-install"
import { SCOPE_OPTIONS } from "@/lib/tokens"
import { cn } from "@/lib/utils"
import { ActorBadge, HumanAvatar } from "@/components/actor-badge"
import { ScopeBadge } from "@/components/scope-badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const CONNECTION_LABELS = {
  [AGENT_CONNECTION.MCP]: "via MCP",
  [AGENT_CONNECTION.API_KEY]: "via API key",
}

// Most recent use across the agent's tokens, or null if never used.
function lastActive(agentId: string) {
  const times = agentTokens
    .filter((t) => t.agent_id === agentId && t.last_used_at)
    .map((t) => t.last_used_at!.getTime())
  return times.length ? new Date(Math.max(...times)) : null
}

export function AgentsView() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [people, setPeople] = useState<{ _id: string; name: string }[]>([])
  const [newIds, setNewIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
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
        // Empty DocDB stays empty — do not push mock demo agents back into the board.
        setAgents(mergeAgentRecords(saved, live))
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

  function connect(agent: Agent) {
    setAgents((current) => [agent, ...current])
    setNewIds((ids) => new Set(ids).add(agent._id))
    saveAgent(agent)
  }

  return (
    <main className="mx-auto flex max-w-screen-xl flex-col gap-6 px-4 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
          <BotIcon className="size-6" aria-hidden="true" />
          Agents
        </h1>
        <p className="text-muted-foreground">
          Every agent belongs to a person. Revoke one and its token stops working right away.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
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
                  onRevoke={revoke}
                />
              ))}
            </TableBody>
          </Table>
        </Card>

        <ConnectAgentCard onConnect={connect} />
      </div>
    </main>
  )
}

function AgentRow({
  agent,
  isNew,
  people,
  onRevoke,
}: {
  agent: Agent
  isNew: boolean
  people: { _id: string; name: string }[]
  onRevoke: (agent: Agent) => void
}) {
  const account = useAuthUser()
  const ownerName =
    people.find((person) => person._id === agent.owner_id)?.name ??
    getUser(agent.owner_id)?.name ??
    (account?._id === agent.owner_id ? account.name : undefined)
  const active = lastActive(agent._id)
  return (
    <TableRow
      className={cn(
        agent.revoked && "text-muted-foreground",
        isNew && "duration-300 animate-in fade-in slide-in-from-top-2"
      )}
    >
      <TableCell className="pl-4">
        <div className={cn("flex flex-col gap-1", agent.revoked && "opacity-60")}>
          <ActorBadge
            actor={{ type: ACTOR_TYPES.AGENT, id: agent._id, name: agent.name, acting_for: agent.owner_id }}
          />
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            {agent.connection === AGENT_CONNECTION.MCP ? (
              <WifiIcon className="size-3.5" aria-hidden="true" />
            ) : (
              <KeyRoundIcon className="size-3.5" aria-hidden="true" />
            )}
            {CONNECTION_LABELS[agent.connection]}
          </span>
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
        <div className={cn("flex flex-col items-start gap-1", agent.revoked && "opacity-60")}>
          {agent.scopes.map((scope) => (
            <ScopeBadge key={scope} scope={scope} />
          ))}
        </div>
      </TableCell>
      <TableCell className="tabular-nums">
        {active ? timeAgo(active) : <span className="text-muted-foreground">Never</span>}
      </TableCell>
      <TableCell className="pr-4 text-right">
        {agent.revoked ? (
          <Badge variant="outline">
            <WifiOffIcon className="size-3" aria-hidden="true" />
            Revoked
          </Badge>
        ) : account?._id === agent.owner_id ? (
          <RevokeDialog agent={agent} ownerName={ownerName} onRevoke={onRevoke} />
        ) : (
          <span className="text-sm text-muted-foreground">Active</span>
        )}
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

function ConnectAgentCard({ onConnect }: { onConnect: (agent: Agent) => void }) {
  const [scopes, setScopes] = useState<Scope[]>([
    SCOPES.TICKETS_READ,
    SCOPES.TICKETS_WRITE,
    SCOPES.COMMENTS_WRITE,
  ])
  const [name, setName] = useState("")
  const [token, setToken] = useState<string>()
  const [install, setInstall] = useState<McpInstallLinks>()
  const [pending, setPending] = useState(false)
  const account = useAuthUser()

  function toggle(scope: Scope, on: boolean) {
    setScopes((current) => (on ? [...current, scope] : current.filter((s) => s !== scope)))
  }

  async function generate() {
    const agentName = name.trim()
    if (!account || !agentName || pending) return
    const ordered = SCOPE_OPTIONS.map((o) => o.scope).filter((s) => scopes.includes(s))
    setPending(true)
    try {
      const connected = await connectAgent({
        name: agentName,
        ownerId: account._id,
        username: account.auth_username,
        scopes: ordered,
        connection: AGENT_CONNECTION.MCP,
      })
      setToken(connected.secret)
      setInstall(connected.install)
      onConnect(connected.agent)
      setName("")
    } catch (error) {
      toast.error(error instanceof ConnectAgentError ? error.message : "Couldn't connect that agent")
    } finally {
      setPending(false)
    }
  }

  async function copy() {
    if (!token) return
    try {
      await navigator.clipboard.writeText(token)
      toast.success("Token copied", { description: "Paste it into your agent's MCP config." })
    } catch {
      toast.error("Couldn't copy", { description: "Select the token and copy it by hand." })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Connect your agent</CardTitle>
        <CardDescription>
          Bring your own agent. Pick what it may do, then paste the token into its MCP config.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 font-mono text-xs tracking-widest text-muted-foreground uppercase">
            1 · Scopes
          </legend>
          {SCOPE_OPTIONS.map(({ scope, label }) => (
            <div key={scope} className="flex items-center gap-2.5">
              <Checkbox
                id={`scope-${scope}`}
                checked={scopes.includes(scope)}
                onCheckedChange={(on) => toggle(scope, on === true)}
              />
              <Label htmlFor={`scope-${scope}`} className="flex-1 font-normal">
                {label}
              </Label>
              <code className="font-mono text-xs text-muted-foreground">{scope}</code>
            </div>
          ))}
        </fieldset>

        <div className="flex flex-col gap-2">
          <Label
            htmlFor="agent-name"
            className="font-mono text-xs font-normal tracking-widest text-muted-foreground uppercase"
          >
            2 · Name it
          </Label>
          <Input
            id="agent-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={account ? `e.g. ${account.name}'s Claude Code` : "e.g. your agent"}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
            3 · Token
          </span>
          {token ? (
            <div className="flex flex-col gap-3 duration-300 animate-in fade-in">
              <div className="flex items-center gap-2 rounded-lg bg-foreground p-3 text-background">
                <code className="min-w-0 flex-1 font-mono text-xs break-all">{token}</code>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="shrink-0 text-background hover:bg-background/15 hover:text-background"
                  onClick={copy}
                  aria-label="Copy token"
                >
                  <CopyIcon aria-hidden="true" />
                </Button>
              </div>
              {install ? <McpInstallActions install={install} /> : null}
              <Alert>
                <AlertTriangleIcon aria-hidden="true" />
                <AlertTitle>This token is shown once</AlertTitle>
                <AlertDescription>
                  Copy it now. We only keep a scrambled version, so we can&apos;t show it again.
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-3 font-mono text-xs text-muted-foreground">
              Your token appears here once.
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex flex-col items-stretch gap-2">
        <Button onClick={generate} disabled={!account || !name.trim() || scopes.length === 0 || pending}>
          <KeyRoundIcon data-icon="inline-start" aria-hidden="true" />
          {pending ? "Connecting…" : "Generate token"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Expires after {DEFAULT_TOKEN_EXPIRY_HOURS} h. Set in Organization.
        </p>
      </CardFooter>
    </Card>
  )
}
