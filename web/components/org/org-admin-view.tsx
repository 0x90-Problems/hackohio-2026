"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import {
  DEFAULT_TOKEN_EXPIRY_HOURS,
  INVITE_EXPIRY_DAYS,
  ORG_ERRORS,
  ORG_ROLES,
  ORG_TEXT,
  type OrgMemberRole,
} from "@/shared/names"
import { Building2Icon, CopyIcon, MailIcon, RefreshCwIcon, Trash2Icon, UsersIcon } from "@/components/icons"
import { useAuthUser } from "@/components/auth/auth-gate"
import { HumanAvatar } from "@/components/actor-badge"
import { absoluteTime } from "@/lib/format"
import {
  OrgApiError,
  canResend,
  canRevoke,
  inviteRowParts,
  inviteUrl,
  plausibleEmail,
  removeBlocked,
  validOrgName,
  type InviteRow,
  type OrgMemberRow,
  type OrgSummary,
} from "@/lib/org-api"
import { orgApi, refreshOrgs, useOrgs } from "@/lib/use-orgs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const explain = (error: unknown) => (error instanceof Error ? error.message : undefined)

function inviteError(error: unknown): string {
  if (error instanceof OrgApiError) {
    if (error.status === 429) return ORG_TEXT.INVITE_LIMIT
    if (error.code === ORG_ERRORS.NOT_CONFIGURED) return ORG_TEXT.NOT_CONFIGURED
    if (error.status === 409) return ORG_TEXT.CHANGED_ELSEWHERE
  }
  return explain(error) ?? ORG_TEXT.ACTION_FAILED
}

// The Organization page with NEXT_PUBLIC_MULTI_ORG on: this org only (the one in the top bar),
// its settings, its members (names and usernames, never emails) and, for admins, its invites.
export function OrgAdminView() {
  const state = useOrgs()
  if (state.status === "loading") {
    return (
      <main className="mx-auto flex max-w-screen-xl flex-col gap-6 px-4 py-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-48 w-full" />
      </main>
    )
  }
  if (state.status === "error" || !state.org) {
    return (
      <main className="mx-auto max-w-screen-xl px-4 py-6">
        <p className="text-sm text-muted-foreground" role="alert">
          {ORG_TEXT.LOAD_FAILED}
        </p>
      </main>
    )
  }
  return <OrgPage key={state.org.org_id} org={state.org} team={state.team?.team_id ?? ""} />
}

function OrgPage({ org, team }: { org: OrgSummary; team: string }) {
  const admin = org.role === ORG_ROLES.ADMIN
  // A team manager may invite members (not admins); the board says who manages the active team.
  const [manager, setManager] = useState(false)
  useEffect(() => {
    if (admin || !team) return
    let cancelled = false
    orgApi.membership(team).then(
      (row) => !cancelled && setManager(row?.org_id === org.org_id && row.manager),
      () => undefined
    )
    return () => {
      cancelled = true
    }
  }, [admin, org.org_id, team])
  return (
    <main className="mx-auto flex max-w-screen-xl flex-col gap-6 px-4 py-6">
      <div className="flex flex-col gap-1 duration-300 animate-in fade-in motion-reduce:animate-none">
        <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">{ORG_TEXT.SETTINGS_TITLE}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{org.name}</h1>
      </div>
      {admin ? <OrgSettings org={org} /> : null}
      <OrgMembers org={org} admin={admin} />
      {admin || manager ? <OrgInvites org={org} admin={admin} /> : <p className="text-sm text-muted-foreground">{ORG_TEXT.ADMIN_ONLY}</p>}
    </main>
  )
}

function OrgSettings({ org }: { org: OrgSummary }) {
  const [name, setName] = useState(org.name)
  const [expiry, setExpiry] = useState(String(DEFAULT_TOKEN_EXPIRY_HOURS))
  const [busy, setBusy] = useState(false)

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!validOrgName(name) || busy) return
    setBusy(true)
    try {
      await orgApi.updateOrg(org.org_id, { name: name.trim(), token_expiry_hours: Number(expiry) })
      toast.success(ORG_TEXT.SAVED)
      void refreshOrgs()
    } catch (error) {
      toast.error(ORG_TEXT.SAVE_FAILED, { description: explain(error) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <form onSubmit={save}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2Icon className="size-5" aria-hidden="true" />
            {ORG_TEXT.SETTINGS_TITLE}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="org-rename">{ORG_TEXT.NAME_LABEL}</Label>
            <Input id="org-rename" value={name} maxLength={60} autoComplete="off" onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="org-token-expiry">{ORG_TEXT.TOKEN_EXPIRY_LABEL}</Label>
            <Select value={expiry} onValueChange={setExpiry}>
              <SelectTrigger id="org-token-expiry" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORG_TEXT.TOKEN_EXPIRY_OPTIONS.map((option) => (
                  <SelectItem key={option.hours} value={String(option.hours)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardFooter className="mt-4 justify-end">
          <Button type="submit" variant="outline" disabled={!validOrgName(name) || busy}>
            {ORG_TEXT.SAVE}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function OrgMembers({ org, admin }: { org: OrgSummary; admin: boolean }) {
  const account = useAuthUser()
  const [members, setMembers] = useState<OrgMemberRow[] | null>(null)
  const [removing, setRemoving] = useState<OrgMemberRow | null>(null)
  const [reload, setReload] = useState(0)
  // Only this org's teams are ever named; a team id from elsewhere shows as nothing.
  const teamName = new Map(org.teams.map((team) => [team.team_id, team.name]))

  useEffect(() => {
    let cancelled = false
    orgApi.members(org.org_id).then(
      (rows) => !cancelled && setMembers(rows),
      (error) => !cancelled && toast.error(ORG_TEXT.LOAD_FAILED, { description: explain(error) })
    )
    return () => {
      cancelled = true
    }
  }, [org.org_id, reload])

  async function remove(member: OrgMemberRow) {
    try {
      await orgApi.removeMember(org.org_id, member.user_id)
      setRemoving(null)
      setReload((n) => n + 1)
    } catch (error) {
      toast.error(error instanceof OrgApiError && error.code === ORG_ERRORS.LAST_ADMIN ? ORG_TEXT.LAST_ADMIN_REMOVE : explain(error) ?? ORG_TEXT.ACTION_FAILED)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UsersIcon className="size-5" aria-hidden="true" />
          {ORG_TEXT.MEMBERS_TITLE}
        </CardTitle>
        <CardDescription>{ORG_TEXT.MEMBERS_HINT}</CardDescription>
      </CardHeader>
      <CardContent>
        {members === null ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{ORG_TEXT.NAME_COLUMN}</TableHead>
                <TableHead>{ORG_TEXT.INVITE_ROLE_LABEL}</TableHead>
                <TableHead>{ORG_TEXT.TEAMS_HEADING}</TableHead>
                {admin ? <TableHead className="w-0" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.user_id} className="duration-200 animate-in fade-in motion-reduce:animate-none">
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <HumanAvatar name={member.name} />
                      <span className="flex flex-col">
                        <span className="font-medium">{member.name}</span>
                        <span className="text-xs text-muted-foreground">@{member.username}</span>
                      </span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.role === ORG_ROLES.ADMIN ? "secondary" : "outline"}>{ORG_TEXT.ROLE_LABELS[member.role]}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {member.teams.map((id) => teamName.get(id)).filter(Boolean).join(", ")}
                  </TableCell>
                  {admin ? (
                    <TableCell>
                      {member.user_id !== account?._id ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={removeBlocked(member, members)}
                          title={removeBlocked(member, members) ? ORG_TEXT.LAST_ADMIN_REMOVE : undefined}
                          onClick={() => setRemoving(member)}
                        >
                          {ORG_TEXT.REMOVE}
                        </Button>
                      ) : null}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <Dialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {removing?.name}: {ORG_TEXT.REMOVE_CONFIRM}
            </DialogTitle>
            <DialogDescription>{ORG_TEXT.REMOVE_HINT}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{ORG_TEXT.CANCEL}</Button>
            </DialogClose>
            <Button variant="destructive" onClick={() => removing && void remove(removing)}>
              <Trash2Icon aria-hidden="true" />
              {ORG_TEXT.REMOVE}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function OrgInvites({ org, admin }: { org: OrgSummary; admin: boolean }) {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<OrgMemberRole>(ORG_ROLES.MEMBER)
  const [days, setDays] = useState(String(INVITE_EXPIRY_DAYS.DEFAULT))
  const [busy, setBusy] = useState(false)
  const [invites, setInvites] = useState<InviteRow[] | null>(null)
  const [reload, setReload] = useState(0)
  // Link mode: each link is shown once, so it's kept only in this page, never stored.
  const [links, setLinks] = useState<Record<string, string>>({})
  const [lastLink, setLastLink] = useState("")

  useEffect(() => {
    if (!admin) return // the list, links, Resend and Revoke are for admins
    let cancelled = false
    orgApi.invites(org.org_id).then(
      (rows) => !cancelled && setInvites(rows),
      (error) => !cancelled && toast.error(ORG_TEXT.LOAD_FAILED, { description: explain(error) })
    )
    return () => {
      cancelled = true
    }
  }, [admin, org.org_id, reload])

  const keepLink = (inviteId: string, link: string | null) => {
    if (!inviteId || !link) return
    const url = inviteUrl(link, window.location.origin)
    setLinks((current) => ({ ...current, [inviteId]: url }))
    setLastLink(url)
  }

  async function send(event: React.FormEvent) {
    event.preventDefault()
    if (!plausibleEmail(email) || busy) return
    setBusy(true)
    try {
      const sent = await orgApi.invite(org.org_id, { email, role, expires_days: Number(days) })
      keepLink(sent.invite_id, sent.link)
      // The same answer whatever the address: never says whether it has an account.
      toast.success(ORG_TEXT.INVITE_SENT, { description: sent.link ? ORG_TEXT.LINK_HINT : admin ? ORG_TEXT.INVITE_SENT_HINT : ORG_TEXT.MANAGER_INVITE_HINT })
      setEmail("")
      setReload((n) => n + 1)
    } catch (error) {
      toast.error(inviteError(error))
    } finally {
      setBusy(false)
    }
  }

  async function resend(invite: InviteRow) {
    try {
      const sent = await orgApi.resendInvite(org.org_id, invite.invite_id)
      keepLink(invite.invite_id, sent.link)
      toast.success(ORG_TEXT.RESENT)
      setReload((n) => n + 1)
    } catch (error) {
      toast.error(inviteError(error))
      if (error instanceof OrgApiError && error.status === 409) setReload((n) => n + 1)
    }
  }

  async function revoke(invite: InviteRow) {
    try {
      await orgApi.revokeInvite(org.org_id, invite.invite_id)
      setLinks((current) => {
        const next = { ...current }
        delete next[invite.invite_id]
        return next
      })
      toast.success(ORG_TEXT.REVOKED)
      setReload((n) => n + 1)
    } catch (error) {
      toast.error(inviteError(error))
      if (error instanceof OrgApiError && error.status === 409) setReload((n) => n + 1)
    }
  }

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link)
      toast.success(ORG_TEXT.LINK_COPIED)
    } catch {
      toast.error(ORG_TEXT.COPY_FAILED)
    }
  }

  const text = { notJoined: ORG_TEXT.NOT_JOINED, states: ORG_TEXT.INVITE_STATES }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MailIcon className="size-5" aria-hidden="true" />
          {ORG_TEXT.INVITES_TITLE}
        </CardTitle>
        <CardDescription>{admin ? ORG_TEXT.INVITES_HINT : ORG_TEXT.MANAGER_INVITE_HINT}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {/* autoComplete off and no list of people: the field never suggests anyone's address. */}
        <form onSubmit={send} autoComplete="off" className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-email">{ORG_TEXT.INVITE_EMAIL_LABEL}</Label>
            <Input
              id="invite-email"
              name="invite-email"
              type="email"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-role">{ORG_TEXT.INVITE_ROLE_LABEL}</Label>
            <Select value={role} onValueChange={(value) => setRole(value as OrgMemberRole)}>
              <SelectTrigger id="invite-role" className="w-full sm:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(admin ? [ORG_ROLES.MEMBER, ORG_ROLES.ADMIN] : [ORG_ROLES.MEMBER]).map((value) => (
                  <SelectItem key={value} value={value}>
                    {ORG_TEXT.ROLE_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-expiry">{ORG_TEXT.INVITE_EXPIRY_LABEL}</Label>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger id="invite-expiry" className="w-full sm:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORG_TEXT.INVITE_EXPIRY_OPTIONS.map((option) => (
                  <SelectItem key={option.days} value={String(option.days)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={!plausibleEmail(email) || busy}>
            {busy ? ORG_TEXT.SENDING : ORG_TEXT.SEND_INVITE}
          </Button>
        </form>

        {lastLink ? (
          <div className="flex flex-col gap-2 rounded-xl border border-dashed p-3 duration-200 animate-in fade-in slide-in-from-top-2 motion-reduce:animate-none">
            <Label htmlFor="invite-link">{ORG_TEXT.LINK_TITLE}</Label>
            <div className="flex gap-2">
              <Input id="invite-link" readOnly value={lastLink} autoComplete="off" spellCheck={false} onFocus={(event) => event.currentTarget.select()} />
              <Button variant="outline" onClick={() => void copy(lastLink)}>
                <CopyIcon aria-hidden="true" />
                {ORG_TEXT.COPY_LINK}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{ORG_TEXT.LINK_HINT}</p>
          </div>
        ) : null}

        {!admin ? null : invites === null ? (
          <Skeleton className="h-10 w-full" />
        ) : invites.length === 0 ? (
          <p className="text-sm text-muted-foreground">{ORG_TEXT.NO_INVITES}</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-xl border">
            {invites.map((invite) => {
              const [who, address, status] = inviteRowParts(invite, text)
              const link = links[invite.invite_id]
              return (
                <li
                  key={invite.invite_id}
                  className="flex flex-col gap-2 p-3 duration-200 animate-in fade-in slide-in-from-top-2 motion-reduce:animate-none sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="truncate">
                      <span className="font-medium">{who}</span>
                      <span className="text-muted-foreground"> — {address} — </span>
                      <span>{status}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ORG_TEXT.ROLE_LABELS[invite.role]}
                      {invite.expires_at ? ` · ${ORG_TEXT.EXPIRES} ${absoluteTime(new Date(invite.expires_at))}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {link && canRevoke(invite) ? (
                      <Button variant="outline" size="sm" onClick={() => void copy(link)}>
                        <CopyIcon aria-hidden="true" />
                        {ORG_TEXT.COPY_LINK}
                      </Button>
                    ) : null}
                    {canResend(invite) ? (
                      <Button variant="outline" size="sm" onClick={() => void resend(invite)}>
                        <RefreshCwIcon aria-hidden="true" />
                        {ORG_TEXT.RESEND}
                      </Button>
                    ) : null}
                    {canRevoke(invite) ? (
                      <Button variant="destructive" size="sm" onClick={() => void revoke(invite)}>
                        {ORG_TEXT.REVOKE}
                      </Button>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
