"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  BookOpenIcon,
  BotIcon,
  ClockIcon,
  CopyIcon,
  KeyRoundIcon,
  ShieldOffIcon,
} from "@/components/icons"
import { toast } from "sonner"

import {
  AGENT_CONNECTION,
  DEFAULT_TOKEN_EXPIRY_HOURS,
  TOKEN_PREFIX,
  type Scope,
} from "@/shared/names"
import { useAuthUser } from "@/components/auth/auth-gate"
import { CleanupInactiveButton, DeleteAgentDialog } from "@/components/agents/delete-agent"
import { loadSite } from "@/lib/site-db"
import { withKeyUsage } from "@/lib/agent-usage"
import {
  ConnectAgentError,
  listBoardAgents,
  listBoardUsers,
  revokeAgentAccess,
} from "@/lib/connect-agent"
import { canDeleteAgent } from "@/lib/delete-agent"
import { timeAgo } from "@/lib/format"
import { boardApiPublicUrl, curlExample, onlyConnection } from "@/lib/rest-api"
import { REST_ENDPOINTS, type RestMethod } from "@/lib/rest-endpoints"
import { maskToken } from "@/lib/tokens"
import { cn } from "@/lib/utils"
import { HumanAvatar } from "@/components/actor-badge"
import { ScopeBadge } from "@/components/scope-badge"
import { withReturn } from "@/lib/return-path"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

// Neutral styles only: no red, blue or purple for HTTP methods.
const METHOD_STYLES: Record<RestMethod, string> = {
  GET: "bg-foreground text-background",
  POST: "bg-secondary text-secondary-foreground border-border",
  PATCH: "bg-transparent text-foreground border-foreground/40",
}

type ApiKey = {
  id?: string
  name: string
  owner_id: string
  token_prefix: string
  last_used_at: Date | null
  scopes: Scope[]
  expired?: boolean
}

async function copyText(text: string, what: string, description?: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${what} copied`, description ? { description } : undefined)
  } catch {
    toast.error("Couldn't copy", { description: "Select the text and copy it by hand." })
  }
}

function CodeLine({ text, what }: { text: string; what: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-foreground p-3 text-background">
      <code className="min-w-0 flex-1 font-mono text-xs break-all">{text}</code>
      <Button
        size="icon-sm"
        variant="ghost"
        className="shrink-0 text-background hover:bg-background/15 hover:text-background"
        onClick={() => copyText(text, what)}
        aria-label={`Copy ${what}`}
      >
        <CopyIcon aria-hidden="true" />
      </Button>
    </div>
  )
}

export function ApiView() {
  const account = useAuthUser()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [people, setPeople] = useState<{ _id: string; name: string }[]>([])
  const baseUrl = boardApiPublicUrl()

  useEffect(() => {
    let cancelled = false
    listBoardUsers()
      .then((users) => {
        if (!cancelled) setPeople(users)
      })
      .catch(() => {
        // Owner names fall back to the signed-in person.
      })
    Promise.all([loadSite(), listBoardAgents().catch(() => [])])
      .then(([site, live]) => {
        if (cancelled) return
        // Saved keys never update last_used_at; the board API knows the real last use and expiry.
        // Only API-key agents count: an MCP agent lives on the Agents page.
        const apiKeyAgents = onlyConnection(live, AGENT_CONNECTION.API_KEY, AGENT_CONNECTION.MCP)
        setKeys(withKeyUsage(site.apiKeys as ApiKey[], apiKeyAgents))
      })
      .catch(() => {
        toast.error("Couldn't load API keys from the database")
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function revoke(key: ApiKey) {
    if (!key.id) return
    try {
      await revokeAgentAccess(key.id)
    } catch (error) {
      const message = error instanceof ConnectAgentError ? error.message : "Couldn't revoke that key"
      if (!message.includes("was not found")) {
        toast.error(message)
        return
      }
    }
    setKeys((current) => current.filter((k) => k !== key))
    toast.success(`Revoked ${key.name}`, { description: "Requests with this key now get 401." })
  }

  // Deleted on the board: drop the rows.
  function forget(agentIds: string[]) {
    const gone = new Set(agentIds)
    setKeys((current) => current.filter((key) => !key.id || !gone.has(key.id)))
  }

  return (
    <main className="mx-auto flex max-w-screen-xl flex-col gap-6 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
            <KeyRoundIcon className="size-6" aria-hidden="true" />
            API
          </h1>
          <p className="text-muted-foreground">
            Script the board over REST from scripts, CI jobs, and integrations.
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

      <Alert>
        <BotIcon aria-hidden="true" />
        <AlertTitle>Connecting an AI agent?</AlertTitle>
        <AlertDescription>
          <span>
            Use{" "}
            <Link href="/agents" className="font-medium text-foreground underline underline-offset-4">
              Agents (MCP)
            </Link>
            . This page is for programs that call the REST API directly.
          </span>
        </AlertDescription>
      </Alert>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Base URL and auth</CardTitle>
              <CardDescription>
                Every request goes to this address and sends an API key in the{" "}
                <code className="font-mono">Authorization</code> header.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <h3 className="font-mono text-xs tracking-widest text-muted-foreground uppercase">Base URL</h3>
                <CodeLine text={baseUrl} what="Base URL" />
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="font-mono text-xs tracking-widest text-muted-foreground uppercase">Header</h3>
                <code className="rounded-lg border p-3 font-mono text-xs">
                  Authorization: Bearer {TOKEN_PREFIX}…
                </code>
                <p className="text-sm text-muted-foreground">
                  A missing, expired, or revoked key gets <code className="font-mono">401</code>. A key without
                  the endpoint&apos;s scope gets <code className="font-mono">403</code>. Keys expire after your
                  organization&apos;s token expiry ({DEFAULT_TOKEN_EXPIRY_HOURS} h by default).
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="font-mono text-xs tracking-widest text-muted-foreground uppercase">Try it</h3>
                <CodeLine text={curlExample(baseUrl)} what="curl example" />
                <p className="text-sm text-muted-foreground">
                  Put the key in <code className="font-mono">NUTSHELL_API_KEY</code> first, so it stays out of
                  your shell history and CI logs.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="pb-0">
            <CardHeader>
              <CardTitle className="text-lg">Endpoints</CardTitle>
              <CardDescription>Paths are relative to the base URL. JSON in, JSON out.</CardDescription>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Method</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead>What it does</TableHead>
                  <TableHead className="pr-6">Scope</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {REST_ENDPOINTS.map((e) => (
                  <TableRow key={`${e.method} ${e.path}`}>
                    <TableCell className="w-20 pl-6">
                      <Badge
                        variant="outline"
                        className={cn("w-16 rounded-md font-mono", METHOD_STYLES[e.method])}
                      >
                        {e.method}
                      </Badge>
                    </TableCell>
                    <TableCell className="w-px font-mono font-semibold whitespace-nowrap">{e.path}</TableCell>
                    <TableCell className="text-muted-foreground">{e.description}</TableCell>
                    <TableCell className="pr-6">
                      {e.scope ? <ScopeBadge scope={e.scope} /> : <span className="text-xs text-muted-foreground">None</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <KeyRoundIcon className="size-4" aria-hidden="true" />
              API keys
            </CardTitle>
            <CardDescription>For scripts, CI, and integrations that call the REST API.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {keys.length === 0 && (
                <li className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
                  <KeyRoundIcon className="size-8" aria-hidden="true" />
                  <span>No API keys yet. Create one for a script or CI job.</span>
                </li>
              )}
              {keys.map((key) => {
                const ownerName =
                  people.find((person) => person._id === key.owner_id)?.name ??
                  (account?._id === key.owner_id ? account.name : undefined)
                const mine = account?._id === key.owner_id
                // The owner or an org admin; only the owner revokes here, as before.
                const deletable = canDeleteAgent(key.owner_id, account?._id, account?.admin === true)
                return (
                  <li
                    key={(key.id ?? key.token_prefix) + key.name}
                    className="flex flex-col gap-1.5 rounded-lg border p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-sm font-semibold">{key.name}</span>
                        {key.expired && (
                          <Badge variant="outline" className="shrink-0">
                            <ClockIcon className="size-3" aria-hidden="true" />
                            Expired
                          </Badge>
                        )}
                      </span>
                      {ownerName && (
                        <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                          <HumanAvatar name={ownerName} /> {ownerName}
                        </span>
                      )}
                    </div>
                    <code className="font-mono text-sm">{maskToken(key.token_prefix || TOKEN_PREFIX)}</code>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      Last used {key.last_used_at ? timeAgo(key.last_used_at) : "never"} ·
                      {key.scopes.map((s) => (
                        <ScopeBadge key={s} scope={s} />
                      ))}
                    </div>
                    {key.id && deletable ? (
                      <div className="flex justify-end gap-2">
                        {mine && <RevokeKeyDialog apiKey={key} onRevoke={revoke} />}
                        <DeleteAgentDialog
                          agentId={key.id}
                          name={key.name}
                          kind="key"
                          ownerName={mine ? undefined : ownerName}
                          onDeleted={(id) => forget([id])}
                        />
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </CardContent>
          <CardFooter className="flex flex-col items-stretch gap-2">
            {/* A page of its own (NSB-68): room for the key and examples, and Back returns here. */}
            <Button className="w-full" asChild>
              <Link href={withReturn("/api/keys/new", "/api")}>
                <KeyRoundIcon data-icon="inline-start" aria-hidden="true" />
                Create API key
              </Link>
            </Button>
            <CleanupInactiveButton
              connection={AGENT_CONNECTION.API_KEY}
              missing={AGENT_CONNECTION.MCP}
              words={{ one: "API key", many: "API keys", otherOne: "agent", otherMany: "agents", otherPage: "Agents page" }}
              onDeleted={forget}
            />
          </CardFooter>
        </Card>
      </div>
    </main>
  )
}

function RevokeKeyDialog({ apiKey, onRevoke }: { apiKey: ApiKey; onRevoke: (key: ApiKey) => void }) {
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
          <DialogTitle>Revoke {apiKey.name}?</DialogTitle>
          <DialogDescription>
            It stops working right away. Scripts and CI jobs that use it will get 401 until you give them a new key.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="destructive" onClick={() => onRevoke(apiKey)}>
              <ShieldOffIcon className="size-4" aria-hidden="true" />
              Revoke
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
