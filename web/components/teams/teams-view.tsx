"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import {
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  UserPlusIcon,
  UsersIcon,
} from "@/components/icons"
import { ACTOR_TYPES, TICKET_STATUS } from "@/shared/names"
import type { Agent, User } from "@/lib/types"
import { useOpenProfile } from "@/components/profile/profile-dialog"
import { useProjects } from "@/components/projects/projects-store"
import {
  addTeamMember,
  createTeam,
  loadSite,
  removeTeamMember,
  renameTeam,
  setTeamManager,
  type SiteState,
} from "@/lib/site-db"
import { useAuthUser } from "@/components/auth/auth-gate"
import { ActorBadge, HumanAvatar } from "@/components/actor-badge"
import { ScopeBadge } from "@/components/scope-badge"
import { SearchCombobox } from "@/components/search-combobox"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"

// "Open" = not done, and made by this person or by their agent.
// (Tickets have no assignee field yet, so this is the closest match.)
function openTicketCount(
  userId: string,
  tickets: {
    status: string
    created_by: { type: string; id: string; acting_for?: string }
  }[]
) {
  return tickets.filter(
    (t) =>
      t.status !== TICKET_STATUS.DONE &&
      (t.created_by.id === userId ||
        (t.created_by.type === ACTOR_TYPES.AGENT &&
          t.created_by.acting_for === userId))
  ).length
}

type SiteTeam = SiteState["teams"][number]
type Person = User & { admin?: boolean }

function explain(error: unknown) {
  return error instanceof Error ? error.message : undefined
}

// Run a team change, report it, and reload. The board decides who may do what;
// its message (e.g. "Only this team's managers…") is shown as is.
async function change(action: () => Promise<unknown>, done: string, onDone: () => void) {
  try {
    await action()
    toast.success(done)
    onDone()
  } catch (error) {
    toast.error("Couldn't change the team", { description: explain(error) })
  }
}

// Accounts from before multiple teams only have `team`.
function teamsOf(person: { team: string; teams?: string[] }) {
  return person.teams ?? (person.team ? [person.team] : [])
}

export function TeamsView() {
  const account = useAuthUser()
  const store = useProjects()
  const [site, setSite] = useState<{ teams: SiteTeam[]; people: Person[] } | null>(null)
  const [reload, setReload] = useState(0)
  const refresh = () => setReload((n) => n + 1)

  useEffect(() => {
    let cancelled = false
    loadSite()
      .then((loaded) => {
        if (cancelled) return
        setSite({ teams: loaded.teams, people: loaded.users.map((user) => ({ ...user, type: ACTOR_TYPES.HUMAN })) })
      })
      .catch(() => {
        if (!cancelled) toast.error("Couldn't load teams")
      })
    return () => {
      cancelled = true
    }
  }, [reload])

  const isAdmin = account?.admin === true
  const agents = store.boardAgents.filter((agent) => !agent.revoked)
  // Your own team first, then alphabetical.
  const teams = [...(site?.teams ?? [])].sort(
    (a, b) => Number(b.name === account?.team) - Number(a.name === account?.team) || a.name.localeCompare(b.name)
  )
  const unassigned = (site?.people ?? []).filter((person) => teamsOf(person).length === 0)

  return (
    <main className="mx-auto flex max-w-screen-xl flex-col gap-6 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
            <UsersIcon className="size-6" aria-hidden="true" />
            Teams
          </h1>
          <p className="text-muted-foreground">
            People, and the agents working for each of them. Managers add and remove people; each person is on one team.
          </p>
        </div>
        <NewTeamDialog onCreated={refresh} />
      </div>

      {site === null ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {teams.map((team) => (
            <TeamCard
              key={team.name}
              team={team}
              people={site.people}
              agents={agents}
              canManage={isAdmin || team.managers.includes(account?._id ?? "")}
              onChanged={refresh}
            />
          ))}
          {teams.length === 0 && (
            <p className="text-muted-foreground">No teams yet. Create one to get started.</p>
          )}
          {unassigned.length > 0 && (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-lg">Not on a team</CardTitle>
                <CardDescription>A team&apos;s manager can add these people from the team card.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col divide-y">
                  {unassigned.map((person) => (
                    <MemberRow key={person._id} user={person} agent={agents.find((agent) => agent.owner_id === person._id)} />
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </main>
  )
}

function TeamCard({
  team,
  people,
  agents,
  canManage,
  onChanged,
}: {
  team: SiteTeam
  people: Person[]
  agents: Agent[]
  canManage: boolean
  onChanged: () => void
}) {
  const members = people.filter((person) => teamsOf(person).includes(team.name))
  const others = people.filter((person) => !teamsOf(person).includes(team.name))
  const activeAgents = agents.filter((agent) => members.some((member) => member._id === agent.owner_id))

  return (
    <Card className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-lg">
          <UsersIcon className="size-4" aria-hidden="true" />
          {team.name}
          {canManage && <RenameTeamButton name={team.name} onRenamed={onChanged} />}
        </CardTitle>
        <CardAction className="text-sm text-muted-foreground">
          {members.length} {members.length === 1 ? "person" : "people"} · {activeAgents.length} agents
        </CardAction>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No one on this team yet.</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {members.map((member) => {
              const isManager = team.managers.includes(member._id)
              return (
                <MemberRow
                  key={member._id}
                  user={member}
                  agent={activeAgents.find((agent) => agent.owner_id === member._id)}
                  extra={
                    <>
                      {isManager && <span className="rounded border px-1.5 text-xs text-muted-foreground">Manager</span>}
                      {canManage && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-7" aria-label={`Manage ${member.name}`}>
                              <MoreHorizontalIcon aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() =>
                                void change(
                                  () => setTeamManager(team.name, member._id, !isManager),
                                  isManager ? `${member.name} is no longer a manager` : `${member.name} now manages ${team.name}`,
                                  onChanged
                                )
                              }
                            >
                              {isManager ? "Remove as manager" : "Make manager"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() =>
                                void change(() => removeTeamMember(team.name, member._id), `Removed ${member.name} from ${team.name}`, onChanged)
                              }
                            >
                              Remove from team
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </>
                  }
                />
              )
            })}
          </ul>
        )}
      </CardContent>
      {canManage && (
        <CardFooter>
          <SearchCombobox
            label="Add people"
            searchPlaceholder="Search people…"
            emptyText="No one else to add."
            trigger={
              <Button variant="outline">
                <UserPlusIcon data-icon="inline-start" aria-hidden="true" />
                Add people
              </Button>
            }
            groups={[
              {
                items: others.map((person) => ({
                  value: person._id,
                  keywords: [person.name, person.auth_username, ...teamsOf(person)],
                  label: (
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{person.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {teamsOf(person).length ? `Also on ${teamsOf(person).join(", ")}` : "Not on a team"}
                      </span>
                    </span>
                  ),
                  onSelect: () =>
                    void change(() => addTeamMember(team.name, person._id), `Added ${person.name} to ${team.name}`, onChanged),
                })),
              },
            ]}
          />
        </CardFooter>
      )}
    </Card>
  )
}

function MemberRow({ user, agent, extra }: { user: User; agent?: Agent; extra?: React.ReactNode }) {
  const store = useProjects()
  const openProfile = useOpenProfile()
  const open = openTicketCount(user._id, store.tickets)
  return (
    <li className="flex items-start gap-3 py-4">
      <button
        type="button"
        aria-label={`Open ${user.name}'s profile`}
        onClick={() => openProfile?.(user._id)}
        className="rounded-full transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <HumanAvatar name={user.name} size="lg" />
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <button type="button" onClick={() => openProfile?.(user._id)} className="text-left font-semibold hover:underline">
            {user.name}
          </button>
          <span className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground tabular-nums">
            {open} open
            {extra}
          </span>
        </div>
        {user.role && <p className="text-sm text-muted-foreground">{user.role}</p>}
        {agent ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <ActorBadge actor={{ type: ACTOR_TYPES.AGENT, id: agent._id, name: agent.name, acting_for: user._id }} />
            {agent.scopes.map((scope) => (
              <ScopeBadge key={scope} scope={scope} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No agent connected</p>
        )}
      </div>
    </li>
  )
}

function NewTeamDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const team = name.trim()
    if (!team) return
    setBusy(true)
    try {
      await createTeam(team)
      toast.success(`Created ${team}`, { description: "You manage it. Add people from the team card." })
      setName("")
      setOpen(false)
      onCreated()
    } catch (error) {
      toast.error("Couldn't create the team", { description: explain(error) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon data-icon="inline-start" aria-hidden="true" />
          New team
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New team</DialogTitle>
            <DialogDescription>You&apos;ll manage it: add people, make other managers, and rename it.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="team-name">Team name</Label>
            <Input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Design crew"
              maxLength={80}
              autoFocus
              required
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!name.trim() || busy}>
              Create team
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Team managers and org admins (the board enforces it too). Members move to the
// new name, and the team's folders follow it.
function RenameTeamButton({ name, onRenamed }: { name: string; onRenamed: () => void }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(name)
  const [busy, setBusy] = useState(false)
  const next = value.trim()

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen)
        if (isOpen) setValue(name)
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7" aria-label={`Rename ${name}`}>
          <PencilIcon className="size-3.5" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault()
            if (!next || next === name) return
            setBusy(true)
            try {
              await renameTeam(name, next)
              toast.success(`Renamed ${name} to ${next}`, { description: "Members and the team's folders moved with it." })
              setOpen(false)
              onRenamed()
            } catch (error) {
              toast.error("Couldn't rename the team", { description: explain(error) })
            } finally {
              setBusy(false)
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Rename team</DialogTitle>
            <DialogDescription>Everyone on {name} moves to the new name. Their folders follow.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="rename-team">Team name</Label>
            <Input id="rename-team" value={value} onChange={(event) => setValue(event.target.value)} maxLength={80} autoFocus required />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!next || next === name || busy}>
              Rename
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
