"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowRightIcon,
  MailIcon,
  PlusIcon,
  UserPlusIcon,
  UsersIcon,
} from "@/components/icons"
import { toast } from "sonner"

import { ACTOR_TYPES, TICKET_STATUS } from "@/shared/names"
import type { Agent, User } from "@/lib/types"
import { TEAM, agents, users } from "@/lib/mock-data"
import { usePersistentState } from "@/lib/local-store"
import { useProjects } from "@/components/projects/projects-store"
import { ActorBadge, HumanAvatar } from "@/components/actor-badge"
import { ScopeBadge } from "@/components/scope-badge"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// "Open" = not done, and made by this person or by their agent.
// (Tickets have no assignee field yet, so this is the closest match.)
function openTicketCount(userId: string, tickets: { status: string; created_by: { type: string; id: string; acting_for?: string } }[]) {
  return tickets.filter(
    (t) =>
      t.status !== TICKET_STATUS.DONE &&
      (t.created_by.id === userId ||
        (t.created_by.type === ACTOR_TYPES.AGENT && t.created_by.acting_for === userId))
  ).length
}

export function TeamsView() {
  // Teams made with "+ New team". They stay after a refresh.
  const [newTeams, setNewTeams] = usePersistentState<string[]>("buck2.teams", [])

  const members = users.filter((u) => u.team === TEAM)
  const activeAgents = agents.filter(
    (a) => !a.revoked && members.some((m) => m._id === a.owner_id)
  )

  return (
    <main className="mx-auto flex max-w-screen-xl flex-col gap-6 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
            <UsersIcon className="size-6" aria-hidden="true" />
            Teams
          </h1>
          <p className="text-muted-foreground">People, and the agents working for each of them.</p>
        </div>
        <NewTeamDialog
          onCreate={(name) => {
            setNewTeams((t) => [...t, name])
            toast.success(`Created ${name}`, { description: "Now invite some people." })
          }}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-lg">
              <UsersIcon className="size-4" aria-hidden="true" />
              {TEAM}
            </CardTitle>
            <CardAction className="text-sm text-muted-foreground">
              {members.length} people · {activeAgents.length} agents
            </CardAction>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y">
              {members.map((user) => (
                <MemberRow
                  key={user._id}
                  user={user}
                  agent={activeAgents.find((a) => a.owner_id === user._id)}
                />
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button asChild variant="link" className="px-0 text-foreground">
              <Link href="/board">
                Open board{" "}
                <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
              </Link>
            </Button>
          </CardFooter>
        </Card>

        {newTeams.map((name) => (
          <EmptyTeamCard key={name} team={name} />
        ))}
        <EmptyTeamCard team={TEAM} />
      </div>
    </main>
  )
}

function MemberRow({ user, agent }: { user: User; agent?: Agent }) {
  const store = useProjects()
  const open = openTicketCount(user._id, store.tickets)
  return (
    <li className="flex items-start gap-3 py-4">
      <HumanAvatar name={user.name} size="lg" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-semibold">{user.name}</span>
          <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
            {open} open
          </span>
        </div>
        {user.role && <p className="text-sm text-muted-foreground">{user.role}</p>}
        {agent ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <ActorBadge
              actor={{ type: ACTOR_TYPES.AGENT, id: agent._id, acting_for: user._id }}
            />
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

// Dashed card for a team with room for more people.
function EmptyTeamCard({ team }: { team: string }) {
  return (
    <Card className="justify-center border-2 border-dashed bg-transparent shadow-none ring-0 duration-300 animate-in fade-in">
      <CardHeader className="justify-items-center text-center">
        <UsersIcon className="size-8 text-muted-foreground" aria-hidden="true" />
        <CardTitle className="text-lg">{team}</CardTitle>
        <CardDescription className="max-w-xs">
          Invite people. Each person connects their own agent from the Agents page.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <InviteDialog team={team} />
      </CardContent>
    </Card>
  )
}

function InviteDialog({ team }: { team: string }) {
  const [open, setOpen] = useState(false)
  const [username, setUsername] = useState("")
  const [role, setRole] = useState("")

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim()) return
    toast.success(`Invite sent to ${username.trim()}`, { description: `They'll join ${team}.` })
    setUsername("")
    setRole("")
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <UserPlusIcon data-icon="inline-start" aria-hidden="true" />
          Invite people
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Invite to {team}</DialogTitle>
            <DialogDescription>
              They create an account, then connect their own agent.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-username" className="flex items-center gap-1.5">
              <MailIcon className="size-4" aria-hidden="true" />
              Username or email
            </Label>
            <Input
              id="invite-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. jordan"
              autoFocus
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-role">Role (optional)</Label>
            <Input
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Frontend"
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant="secondary" disabled={!username.trim()}>
              Send invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function NewTeamDialog({ onCreate }: { onCreate: (name: string) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onCreate(name.trim())
    setName("")
    setOpen(false)
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
            <DialogDescription>You can invite people after it&apos;s made.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="team-name">Team name</Label>
            <Input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Design crew"
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
            <Button type="submit" disabled={!name.trim()}>
              Create team
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
