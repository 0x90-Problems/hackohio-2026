"use client"

import { Fragment, useState } from "react"
import { ArrowRightIcon } from "lucide-react"
import { toast } from "sonner"

import { DEFAULT_TOKEN_EXPIRY_HOURS } from "@/shared/names"
import { TEAM, agents, currentUser, users } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import { AgentTag, HumanAvatar } from "@/components/actor-badge"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// No organization collection yet, so the name is a placeholder.
const DEFAULT_ORG_NAME = "HackOHI/O 2026"

const EXPIRY_OPTIONS = [
  { hours: 1, label: "1 hour" },
  { hours: 8, label: "8 hours" },
  { hours: 24, label: "24 hours" },
  { hours: 72, label: "3 days" },
  { hours: 168, label: "7 days" },
]

const RULES = [
  { id: "approve_before_close", label: "A human must approve before a ticket closes" },
  { id: "commit_on_move", label: "Agents must link a commit when they move a ticket" },
  { id: "log_agent_actions", label: "Log every agent action" },
]

export function OrganizationView() {
  const [orgName, setOrgName] = useState(DEFAULT_ORG_NAME)
  const [savedName, setSavedName] = useState(DEFAULT_ORG_NAME)
  const [expiry, setExpiry] = useState(String(DEFAULT_TOKEN_EXPIRY_HOURS))
  const [rules, setRules] = useState<Record<string, boolean>>(
    Object.fromEntries(RULES.map((r) => [r.id, true]))
  )

  const myAgent = agents.find((a) => a.owner_id === currentUser._id && !a.revoked)
  const teamCount = new Set(users.map((u) => u.team)).size
  const agentCount = agents.filter((a) => !a.revoked).length

  const flow = [
    { kind: "Organization", content: <span className="truncate">{orgName || "Untitled"}</span> },
    { kind: "Team", content: <span className="truncate">{currentUser.team}</span> },
    {
      kind: "User",
      content: (
        <span className="inline-flex items-center gap-1.5">
          <HumanAvatar name={currentUser.name} /> {currentUser.name}
        </span>
      ),
    },
    {
      kind: "Agent",
      dashed: true,
      content: (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <AgentTag /> <span className="truncate">{myAgent?.name ?? "No agent yet"}</span>
        </span>
      ),
    },
  ]

  function saveName(e: React.FormEvent) {
    e.preventDefault()
    if (!orgName.trim()) return
    setSavedName(orgName.trim())
    toast.success("Organization name saved")
  }

  return (
    <main className="mx-auto flex max-w-screen-xl flex-col gap-6 px-4 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Organization</h1>
        <p className="text-muted-foreground">
          Who owns what, and the rules every agent in the org follows.
        </p>
      </div>

      {/* How access flows */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How access flows</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
            {flow.map((box, i) => (
              <Fragment key={box.kind}>
                {i > 0 && (
                  <ArrowRightIcon
                    className="size-4 shrink-0 self-center text-muted-foreground max-md:rotate-90"
                    aria-hidden
                  />
                )}
                <div
                  className={cn(
                    "flex min-w-0 flex-1 flex-col gap-1.5 rounded-xl border border-foreground/30 p-4",
                    box.dashed && "border-dashed border-muted-foreground/60 bg-muted/50"
                  )}
                >
                  <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
                    {box.kind}
                  </span>
                  <span className="flex min-w-0 font-semibold">{box.content}</span>
                </div>
              </Fragment>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            An agent can never do more than the person it acts for.
          </p>
        </CardContent>
      </Card>

      <div className="grid items-start gap-6 md:grid-cols-2">
        {/* Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <form onSubmit={saveName} className="flex flex-col gap-2">
              <Label htmlFor="org-name">Organization name</Label>
              <div className="flex gap-2">
                <Input
                  id="org-name"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                />
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={!orgName.trim() || orgName.trim() === savedName}
                >
                  Save
                </Button>
              </div>
            </form>
            <dl className="flex gap-10">
              {[
                { label: "Teams", value: teamCount },
                { label: "People", value: users.length },
                { label: "Agents", value: agentCount },
              ].map((stat) => (
                <div key={stat.label} className="flex flex-col gap-1">
                  <dt className="text-sm text-muted-foreground">{stat.label}</dt>
                  <dd className="text-3xl font-semibold tabular-nums">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        {/* Agent rules */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Agent rules</CardTitle>
            <CardDescription>Apply to every agent in {TEAM}.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="token-expiry">Agent tokens expire after</Label>
              <Select
                value={expiry}
                onValueChange={(value) => {
                  setExpiry(value)
                  const label = EXPIRY_OPTIONS.find((o) => String(o.hours) === value)?.label
                  toast.success(`Tokens now expire after ${label}`, {
                    description: "Applies to new tokens.",
                  })
                }}
              >
                <SelectTrigger id="token-expiry" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRY_OPTIONS.map((o) => (
                    <SelectItem key={o.hours} value={String(o.hours)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-3">
              {RULES.map((rule) => (
                <div key={rule.id} className="flex items-center gap-2.5">
                  <Checkbox
                    id={rule.id}
                    checked={rules[rule.id]}
                    onCheckedChange={(on) => {
                      setRules((r) => ({ ...r, [rule.id]: on === true }))
                      toast(on === true ? "Rule turned on" : "Rule turned off", {
                        description: rule.label,
                      })
                    }}
                  />
                  <Label htmlFor={rule.id} className="font-normal">
                    {rule.label}
                  </Label>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter>
            <p className="text-xs text-muted-foreground">
              Login and 2FA for people are handled by Authelia.
            </p>
          </CardFooter>
        </Card>
      </div>
    </main>
  )
}
