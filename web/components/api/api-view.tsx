"use client"

import { useState } from "react"
import {
  AlertTriangleIcon,
  BookOpenIcon,
  CopyIcon,
  KeyRoundIcon,
} from "@/components/icons"
import { toast } from "sonner"

import {
  AGENT_CONNECTION,
  MCP_TOOLS,
  SCOPES,
  TOKEN_PREFIX,
  type Scope,
} from "@/shared/names"
import {
  MOCK_NOW,
  agentTokens,
  agents,
  currentUser,
  getUser,
} from "@/lib/mock-data"
import { timeAgo } from "@/lib/format"
import { SCOPE_OPTIONS, makeToken, maskToken } from "@/lib/tokens"
import { cn } from "@/lib/utils"
import { HumanAvatar } from "@/components/actor-badge"
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
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

// Where the MCP server will live. Swap for the deployed URL later.
const SERVER_URL = "http://localhost:3000"

const MCP_CONFIG = `{
  "mcpServers": {
    "buck2agents": {
      "url": "${SERVER_URL}/mcp",
      "headers": { "Authorization": "Bearer ${TOKEN_PREFIX}your_agent_token" }
    }
  }
}`

const TOOL_DESCRIPTIONS: Record<string, string> = {
  [MCP_TOOLS.GET_BOARD]: "Read every ticket on the board",
  [MCP_TOOLS.CREATE_TICKET]: "Add a ticket to Backlog",
  [MCP_TOOLS.MOVE_TICKET]: "Move a ticket to another column",
  [MCP_TOOLS.ADD_COMMENT]: "Comment on a ticket",
  [MCP_TOOLS.LINK_COMMIT]: "Attach a git commit to a ticket",
  [MCP_TOOLS.WATCH_CHANGES]: "Get told when the board changes",
}

type Method = "GET" | "POST" | "PATCH"
const ENDPOINTS: { method: Method; path: string; description: string }[] = [
  { method: "GET", path: "/tickets", description: "List tickets on a board" },
  { method: "POST", path: "/tickets", description: "Create a ticket" },
  { method: "PATCH", path: "/tickets/:key", description: "Move or edit a ticket" },
  { method: "POST", path: "/tickets/:key/comments", description: "Comment as a person or agent" },
  { method: "GET", path: "/events", description: "Live stream of board changes" },
  { method: "GET", path: "/agents", description: "List agents and their owners" },
]

// Neutral styles only: no red, blue or purple for HTTP methods.
const METHOD_STYLES: Record<Method, string> = {
  GET: "bg-foreground text-background",
  POST: "bg-secondary text-secondary-foreground border-border",
  PATCH: "bg-transparent text-foreground border-foreground/40",
}

type ApiKey = {
  name: string
  owner_id: string
  token_prefix: string
  last_used_at: Date | null
  scopes: Scope[]
}

// Existing keys: agents that connect with an API key, plus their current token.
const initialKeys: ApiKey[] = agents
  .filter((a) => a.connection === AGENT_CONNECTION.API_KEY && !a.revoked)
  .flatMap((a) => {
    const token = agentTokens.find(
      (t) => t.agent_id === a._id && !t.revoked && t.expires_at > MOCK_NOW
    )
    return token
      ? [{ name: a.name, owner_id: a.owner_id, token_prefix: token.token_prefix, last_used_at: token.last_used_at, scopes: token.scopes }]
      : []
  })

async function copyText(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${what} copied`)
  } catch {
    toast.error("Couldn't copy", { description: "Select the text and copy it by hand." })
  }
}

export function ApiView() {
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys)
  const [newKeyName, setNewKeyName] = useState<string>()

  return (
    <main className="mx-auto flex max-w-screen-xl flex-col gap-6 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
            <KeyRoundIcon className="size-6" aria-hidden="true" />
            API
          </h1>
          <p className="text-muted-foreground">
            Connect any agent over MCP, or script the board over HTTP.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() =>
            toast("OpenAPI docs aren't published yet", {
              description: "Tracked in CLW-14 · Draft OpenAPI spec for tickets.",
            })
          }
        >
          <BookOpenIcon data-icon="inline-start" aria-hidden="true" />
          View OpenAPI docs
        </Button>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* MCP */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Connect over MCP</CardTitle>
              <CardDescription>
                Add this to your agent&apos;s MCP config. Use the token from the Agents page.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="relative">
                <pre className="overflow-x-auto rounded-lg bg-foreground p-4 pr-12 font-mono text-xs leading-relaxed text-background">
                  {MCP_CONFIG}
                </pre>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="absolute top-2 right-2 text-background hover:bg-background/15 hover:text-background"
                  onClick={() => copyText(MCP_CONFIG, "MCP config")}
                  aria-label="Copy MCP config"
                >
                  <CopyIcon aria-hidden="true" />
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
                  Tools your agent gets
                </h3>
                <div className="flex flex-wrap gap-2">
                  {Object.values(MCP_TOOLS).map((tool) => (
                    <Tooltip key={tool}>
                      <TooltipTrigger asChild>
                        <Badge variant="secondary" className="cursor-default rounded-md font-mono">
                          {tool}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>{TOOL_DESCRIPTIONS[tool]}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* HTTP */}
          <Card className="pb-0">
            <CardHeader>
              <CardTitle className="text-lg">HTTP endpoints</CardTitle>
              <CardDescription>
                Send the same token as <code className="font-mono">Authorization: Bearer …</code>
              </CardDescription>
            </CardHeader>
            <Table>
              <TableBody>
                {ENDPOINTS.map((e) => (
                  <TableRow key={`${e.method} ${e.path}`}>
                    <TableCell className="w-20 pl-6">
                      <Badge
                        variant="outline"
                        className={cn("w-16 rounded-md font-mono", METHOD_STYLES[e.method])}
                      >
                        {e.method}
                      </Badge>
                    </TableCell>
                    <TableCell className="w-px pr-6 font-mono font-semibold whitespace-nowrap">
                      {e.path}
                    </TableCell>
                    <TableCell className="pr-6 text-muted-foreground">{e.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>

        {/* API keys */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <KeyRoundIcon className="size-4" aria-hidden="true" />
              API keys
            </CardTitle>
            <CardDescription>
              For scripts and always-on agents that can&apos;t sign in through MCP.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {keys.length === 0 && (
                <li className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
                  <KeyRoundIcon className="size-8" aria-hidden="true" />
                  <span>No API keys yet. Create one for a script or agent.</span>
                </li>
              )}
              {keys.map((key) => {
                const owner = getUser(key.owner_id)
                return (
                  <li
                    key={key.token_prefix + key.name}
                    className={cn(
                      "flex flex-col gap-1.5 rounded-lg border p-3",
                      key.name === newKeyName && "duration-300 animate-in fade-in slide-in-from-top-2"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{key.name}</span>
                      {owner && (
                        <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                          <HumanAvatar name={owner.name} /> {owner.name}
                        </span>
                      )}
                    </div>
                    <code className="font-mono text-sm">{maskToken(key.token_prefix)}</code>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      Last used {key.last_used_at ? timeAgo(key.last_used_at) : "never"} ·
                      {key.scopes.map((s) => (
                        <ScopeBadge key={s} scope={s} />
                      ))}
                    </div>
                  </li>
                )
              })}
            </ul>
          </CardContent>
          <CardFooter>
            <CreateKeyDialog
              onCreate={(key) => {
                setKeys((current) => [key, ...current])
                setNewKeyName(key.name)
              }}
            />
          </CardFooter>
        </Card>
      </div>
    </main>
  )
}

function CreateKeyDialog({ onCreate }: { onCreate: (key: ApiKey) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [scopes, setScopes] = useState<Scope[]>([SCOPES.TICKETS_READ])
  const [secret, setSecret] = useState<string>()

  function reset(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      setName("")
      setScopes([SCOPES.TICKETS_READ])
      setSecret(undefined)
    }
  }

  function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || scopes.length === 0) return
    const key = makeToken()
    setSecret(key)
    onCreate({
      name: name.trim(),
      owner_id: currentUser._id,
      token_prefix: key.slice(0, TOKEN_PREFIX.length + 2),
      last_used_at: null,
      scopes: SCOPE_OPTIONS.map((o) => o.scope).filter((s) => scopes.includes(s)),
    })
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button className="w-full">
          <KeyRoundIcon data-icon="inline-start" aria-hidden="true" />
          Create API key
        </Button>
      </DialogTrigger>
      <DialogContent>
        {secret ? (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Your new API key</DialogTitle>
              <DialogDescription>Paste it into your script or always-on agent.</DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2 rounded-lg bg-foreground p-3 text-background">
              <code className="min-w-0 flex-1 font-mono text-xs break-all">{secret}</code>
              <Button
                size="icon-sm"
                variant="ghost"
                className="shrink-0 text-background hover:bg-background/15 hover:text-background"
                onClick={() => copyText(secret, "API key")}
                aria-label="Copy API key"
              >
                <CopyIcon aria-hidden="true" />
              </Button>
            </div>
            <Alert>
              <AlertTriangleIcon aria-hidden="true" />
              <AlertTitle>This key is shown once</AlertTitle>
              <AlertDescription>
                Copy it now. We only keep a scrambled version, so we can&apos;t show it again.
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Done</Button>
              </DialogClose>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={create} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Create API key</DialogTitle>
              <DialogDescription>Pick a name and what the key may do.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="key-name">Name</Label>
              <Input
                id="key-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Nightly report script"
                autoFocus
                required
              />
            </div>
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-2 text-sm font-medium">Scopes</legend>
              {SCOPE_OPTIONS.map(({ scope, label }) => (
                <div key={scope} className="flex items-center gap-2.5">
                  <Checkbox
                    id={`key-scope-${scope}`}
                    checked={scopes.includes(scope)}
                    onCheckedChange={(on) =>
                      setScopes((cur) =>
                        on === true ? [...cur, scope] : cur.filter((s) => s !== scope)
                      )
                    }
                  />
                  <Label htmlFor={`key-scope-${scope}`} className="flex-1 font-normal">
                    {label}
                  </Label>
                  <code className="font-mono text-xs text-muted-foreground">{scope}</code>
                </div>
              ))}
            </fieldset>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={!name.trim() || scopes.length === 0}>
                Create API key
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
