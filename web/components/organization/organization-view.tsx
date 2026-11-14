"use client"

import { Fragment, useEffect, useState } from "react"
import {
  BotIcon,
  Building2Icon,
  ChevronRightIcon,
  MoreHorizontalIcon,
  SettingsIcon,
  UserIcon,
  UsersIcon,
} from "@/components/icons"
import { toast } from "sonner"

import { DEFAULT_TOKEN_EXPIRY_HOURS } from "@/shared/names"
import { useAuthUser } from "@/components/auth/auth-gate"
import { useOpenProfile } from "@/components/profile/profile-dialog"
import { useProjects } from "@/components/projects/projects-store"
import { RemovePersonDialog } from "@/components/teams/remove-person-dialog"
import { loadSite, saveOrganization, type SiteState } from "@/lib/site-db"
import { absoluteTime, timeAgo } from "@/lib/format"
import { ROLE_LABELS, orgCounts, orgMembers, teamsOf, type OrgMember } from "@/lib/org-members"
import { canRemovePerson } from "@/lib/remove-person"
import { cn } from "@/lib/utils"
import { AgentTag, HumanAvatar } from "@/components/actor-badge"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Person = SiteState["users"][number]

// No organization collection yet, so the name is a placeholder.
const DEFAULT_ORG_NAME = "NutShell"

const EXPIRY_OPTIONS = [
  { hours: 1, label: "1 hour" },
  { hours: 8, label: "8 hours" },
  { hours: 24, label: "24 hours" },
  { hours: 72, label: "3 days" },
  { hours: 168, label: "7 days" },
]

const RULES = [
  { id: "approve_before_close", label: "Agents need a person's approval to close tickets (each project can change this)" },
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
  // Teams and people from the board. Null until it loads.
  const [site, setSite] = useState<Pick<SiteState, "teams" | "users"> | null>(null)
  const [reload, setReload] = useState(0)
  const [removing, setRemoving] = useState<Person | null>(null)

  useEffect(() => {
    let cancelled = false
    loadSite()
      .then((loaded) => {
        if (cancelled) return
        setSite({ teams: loaded.teams, users: loaded.users })
        // Only the first load fills the form, so a reload never undoes an unsaved name.
        if (reload > 0 || !loaded.organization) return
        setOrgName(loaded.organization.name)
        setSavedName(loaded.organization.name)
        setExpiry(String(loaded.organization.token_expiry_hours))
        setRules((current) => ({ ...current, ...loaded.organization?.rules }))
      })
      .catch(() => {
        if (!cancelled) toast.error("Couldn't load the organization from the database")
      })
    return () => {
      cancelled = true
    }
  }, [reload])

  const account = useAuthUser()
  const store = useProjects()
  // Real board data. The page used mock-data.ts before, so its numbers were made up.
  const counts = site ? orgCounts(site, store.boardAgents) : null
  const members = site
    ? orgMembers(site, store.boardAgents, [...store.activity, ...store.comments, ...store.tickets])
    : null
  const myAgents = store.boardAgents.filter((a) => a.owner_id === account?._id && !a.revoked)
  const me = site?.users.find((u) => u._id === account?._id)
  const myTeam = account?.team || (me ? teamsOf(me)[0] : undefined)

  const flow = [
    {
      kind: "Organization",
      icon: Building2Icon,
      content: <span className="truncate">{orgName || "Untitled"}</span>,
    },
    { kind: "Team", icon: UsersIcon, content: <span className="truncate">{myTeam || "No team yet"}</span> },
    {
      kind: "User",
      icon: UserIcon,
      content: (
        <span className="inline-flex items-center gap-1.5">
          <HumanAvatar name={account?.name ?? ""} /> {account?.name}
        </span>
      ),
    },
    {
      kind: "Agent",
      icon: BotIcon,
      dashed: true,
      content: (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <AgentTag />{" "}
          <span className="truncate">
            {myAgents.length === 0
              ? "No agent yet"
              : myAgents.length === 1
                ? myAgents[0].name
                : `${myAgents[0].name} +${myAgents.length - 1} more`}
          </span>
        </span>
      ),
    },
  ]

  const admin = account?.admin === true

  function persist(next: { name?: string; expiry?: string; rules?: Record<string, boolean> } = {}) {
    if (!admin) return
    saveOrganization({
      name: (next.name ?? savedName).trim() || DEFAULT_ORG_NAME,
      token_expiry_hours: Number(next.expiry ?? expiry),
      rules: next.rules ?? rules,
    })
  }

  function saveName(e: React.FormEvent) {
    e.preventDefault()
    const name = orgName.trim()
    if (!name) return
    setSavedName(name)
    persist({ name })
    toast.success("Organization name saved")
  }

  return (
    <main className="mx-auto flex max-w-screen-xl flex-col gap-6 px-4 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
          <Building2Icon className="size-6" aria-hidden="true" />
          Organization
        </h1>
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
                  <ChevronRightIcon
                    className="size-4 shrink-0 self-center text-muted-foreground max-md:rotate-90"
                    aria-hidden="true"
                  />
                )}
                <div
                  className={cn(
                    "flex min-w-0 flex-1 flex-col gap-1.5 rounded-xl border border-foreground/30 p-4",
                    box.dashed && "border-dashed border-muted-foreground/60 bg-muted/50"
                  )}
                >
                  <span className="inline-flex items-center gap-1.5 font-mono text-xs tracking-widest text-muted-foreground uppercase">
                    <box.icon className="size-3.5" aria-hidden="true" />
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
                  disabled={!admin}
                />
                {admin ? (
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={!orgName.trim() || orgName.trim() === savedName}
                >
                  Save
                </Button>
                ) : null}
              </div>
            </form>
            <dl className="flex gap-10">
              {[
                { label: "Teams", value: counts?.teams },
                { label: "People", value: counts?.people },
                { label: "Agents", value: counts?.agents },
              ].map((stat) => (
                <div key={stat.label} className="flex flex-col gap-1">
                  <dt className="text-sm text-muted-foreground">{stat.label}</dt>
                  <dd className="text-3xl font-semibold tabular-nums">
                    {stat.value ?? <Skeleton className="h-9 w-10" />}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        {/* Agent rules */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <SettingsIcon className="size-4" aria-hidden="true" />
              Agent rules
            </CardTitle>
            <CardDescription>Apply to every agent in {savedName}.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="token-expiry">Agent tokens expire after</Label>
              <Select
                value={expiry}
                disabled={!admin}
                onValueChange={(value) => {
                  if (!admin) return
                  setExpiry(value)
                  persist({ expiry: value })
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
                    disabled={!admin}
                    onCheckedChange={(on) => {
                      const next = { ...rules, [rule.id]: on === true }
                      setRules(next)
                      persist({ rules: next })
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
              People sign in with an account. Agents use tokens.
            </p>
          </CardFooter>
        </Card>
      </div>

      <MembersCard
        members={members}
        canRemove={(person) => canRemovePerson(person, site?.users ?? [], account?._id, admin)}
        onRemove={setRemoving}
      />
      <RemovePersonDialog
        person={removing}
        onOpenChange={(open) => {
          if (!open) setRemoving(null)
        }}
        onRemoved={() => setReload((n) => n + 1)}
      />
    </main>
  )
}

// "just now", "6 min ago", "2 h ago".
function ago(date: Date) {
  const text = timeAgo(date)
  return text === "just now" ? text : `${text} ago`
}

// Everyone in the organization, with their role, teams, agents and last activity.
// Org admins can remove someone here too, with the same rules as the Teams page.
function MembersCard({
  members,
  canRemove,
  onRemove,
}: {
  members: OrgMember[] | null
  canRemove: (person: Person) => boolean
  onRemove: (person: Person) => void
}) {
  const openProfile = useOpenProfile()
  return (
    <Card className="pb-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <UsersIcon className="size-4" aria-hidden="true" />
          Members
        </CardTitle>
        <CardDescription>
          Everyone in the organization. Team managers add and remove people on the Teams page.
        </CardDescription>
      </CardHeader>
      {members === null ? (
        <CardContent className="flex flex-col gap-3 pb-6">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </CardContent>
      ) : members.length === 0 ? (
        <CardContent className="pb-6">
          <p className="text-sm text-muted-foreground">No one in the organization yet.</p>
        </CardContent>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Person</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Teams</TableHead>
              <TableHead className="text-right">Agents</TableHead>
              <TableHead>Last active</TableHead>
              <TableHead className="pr-6">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.person._id}>
                <TableCell className="pl-6">
                  <button
                    type="button"
                    onClick={() => openProfile?.(member.person._id)}
                    className="inline-flex items-center gap-2 rounded-md text-left font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <HumanAvatar name={member.person.name} />
                    {member.person.name}
                  </button>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={member.role === "member" ? "outline" : "secondary"}
                    title={member.role === "manager" ? `Manages ${member.managerOf.join(", ")}` : undefined}
                  >
                    {ROLE_LABELS[member.role]}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-64 truncate text-muted-foreground">
                  {member.teams.length ? member.teams.join(", ") : "Not on a team"}
                </TableCell>
                <TableCell className="text-right tabular-nums">{member.agents}</TableCell>
                <TableCell className="text-muted-foreground">
                  {member.lastActive ? (
                    <time dateTime={member.lastActive.toISOString()} title={absoluteTime(member.lastActive)}>
                      {ago(member.lastActive)}
                    </time>
                  ) : null}
                </TableCell>
                <TableCell className="pr-6 text-right">
                  {canRemove(member.person) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-7" aria-label={`Manage ${member.person.name}`}>
                          <MoreHorizontalIcon aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem variant="destructive" onSelect={() => onRemove(member.person)}>
                          Remove from organization
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  )
}
