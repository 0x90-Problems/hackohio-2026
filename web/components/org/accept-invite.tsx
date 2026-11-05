"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { toast } from "sonner"

import { ORG_ERRORS, ORG_TEXT } from "@/shared/names"
import { Building2Icon, CheckCircle2Icon, MailIcon } from "@/components/icons"
import { readSession, subscribeAuth } from "@/lib/board-auth"
import { absoluteTime } from "@/lib/format"
import { OrgApiError, tokenFromLocation, type InvitePreview, type OrgTeam } from "@/lib/org-api"
import { dropInvite, heldInvite, holdInvite } from "@/lib/pending-invite"
import { chooseOrg } from "@/lib/team-choice"
import { orgApi, refreshOrgs } from "@/lib/use-orgs"
import { VerifyEmail } from "@/components/org/verify-email"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

type Step =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "signed-out" }
  | { kind: "invalid" }
  | { kind: "preview"; preview: InvitePreview }
  | { kind: "verify"; preview: InvitePreview }
  | { kind: "joined"; orgId: string; teamId: string; orgName: string; teams: OrgTeam[] }

const signedIn = () => Boolean(readSession()?.secret)

// /invite#nsi_…: preview → sign in or up → (email mode: verify your email) → Join → pick a team.
// The token comes from the fragment, is held in this tab while you sign in, and is dropped
// from the address straight away so it isn't left in history or copied on.
export function AcceptInvite() {
  const isSignedIn = useSyncExternalStore(subscribeAuth, signedIn, () => false)
  const [token, setToken] = useState<string | null>(null)
  const [step, setStep] = useState<Step>({ kind: "loading" })
  const [busy, setBusy] = useState(false)
  const [team, setTeam] = useState("")

  // Read the token once, on the client: from the address, or the one held while signing in.
  useEffect(() => {
    const fromUrl = tokenFromLocation(window.location.hash, window.location.search)
    if (fromUrl) {
      holdInvite(fromUrl)
      window.history.replaceState(null, "", "/invite")
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the address is only readable after mount
    setToken(fromUrl || heldInvite())
  }, [])

  useEffect(() => {
    if (token === null) return
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- derived from the token read above
      setStep({ kind: "missing" })
      return
    }
    if (!isSignedIn) {
      setStep({ kind: "signed-out" })
      return
    }
    let cancelled = false
    orgApi.previewInvite(token).then(
      (preview) => !cancelled && setStep({ kind: "preview", preview }),
      () => {
        if (cancelled) return
        dropInvite()
        setStep({ kind: "invalid" }) // one answer for bad, used or expired
      }
    )
    return () => {
      cancelled = true
    }
  }, [token, isSignedIn])

  async function join(preview: InvitePreview) {
    if (!token || busy) return
    setBusy(true)
    try {
      const joined = await orgApi.acceptInvite(token)
      dropInvite()
      const state = await refreshOrgs()
      const org = state.status === "ready" ? state.orgs.find((row) => row.org_id === joined.org_id) : undefined
      const teams = org?.teams ?? []
      setTeam(joined.team_id || org?.default_team_id || teams[0]?.team_id || "")
      setStep({ kind: "joined", orgId: joined.org_id, teamId: joined.team_id, orgName: org?.name || preview.org_name, teams })
    } catch (error) {
      if (error instanceof OrgApiError && error.code === ORG_ERRORS.EMAIL_MISMATCH) {
        setStep({ kind: "verify", preview }) // email mode: the invite is for a verified address
      } else if (error instanceof OrgApiError && error.code === ORG_ERRORS.INVITE_INVALID) {
        dropInvite()
        setStep({ kind: "invalid" })
      } else {
        toast.error(error instanceof Error ? error.message : ORG_TEXT.INVITE_INVALID)
      }
    } finally {
      setBusy(false)
    }
  }

  function start(orgId: string) {
    chooseOrg({ org: orgId, team })
    window.location.assign("/projects")
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <Card className="duration-300 animate-in fade-in motion-reduce:animate-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MailIcon className="size-5" aria-hidden="true" />
            {step.kind === "joined" ? ORG_TEXT.JOINED : ORG_TEXT.ACCEPT_TITLE}
          </CardTitle>
          {step.kind === "signed-out" ? <CardDescription>{ORG_TEXT.ACCEPT_SIGN_IN}</CardDescription> : null}
          {step.kind === "missing" ? <CardDescription>{ORG_TEXT.INVITE_MISSING}</CardDescription> : null}
          {step.kind === "invalid" ? <CardDescription role="alert">{ORG_TEXT.INVITE_INVALID}</CardDescription> : null}
        </CardHeader>

        {step.kind === "loading" ? (
          <CardContent className="flex flex-col gap-2">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        ) : null}

        {step.kind === "preview" || step.kind === "verify" ? (
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-xl border p-3">
              <span className="flex size-10 items-center justify-center rounded-lg border bg-muted/40">
                <Building2Icon className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium">{step.preview.org_name}</p>
                <p className="text-xs text-muted-foreground">
                  <Badge variant="outline" className="mr-1.5">
                    {ORG_TEXT.ROLE_LABELS[step.preview.role]}
                  </Badge>
                  {step.preview.expires_at ? absoluteTime(new Date(step.preview.expires_at)) : null}
                </p>
              </div>
            </div>
            {step.kind === "verify" ? <VerifyEmail onVerified={() => void join(step.preview)} /> : null}
          </CardContent>
        ) : null}

        {step.kind === "joined" ? (
          <CardContent className="flex flex-col gap-3">
            <p className="flex items-center gap-2 text-sm">
              <CheckCircle2Icon className="size-4" aria-hidden="true" />
              {step.orgName}
            </p>
            {step.teams.length > 1 ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">{ORG_TEXT.PICK_TEAM}</p>
                <Select value={team} onValueChange={setTeam}>
                  <SelectTrigger aria-label={ORG_TEXT.PICK_TEAM} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {step.teams.map((row) => (
                      <SelectItem key={row.team_id} value={row.team_id}>
                        {row.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </CardContent>
        ) : null}

        <CardFooter className="flex flex-wrap justify-end gap-2">
          {step.kind === "signed-out" ? (
            <>
              <Button asChild variant="outline">
                <Link href="/signup">{ORG_TEXT.SIGN_UP}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/login">{ORG_TEXT.SIGN_IN}</Link>
              </Button>
            </>
          ) : null}
          {step.kind === "preview" ? (
            <Button onClick={() => void join(step.preview)} disabled={busy}>
              {busy ? ORG_TEXT.JOINING : ORG_TEXT.JOIN}
            </Button>
          ) : null}
          {step.kind === "joined" ? (
            <Button variant="outline" onClick={() => start(step.orgId)}>
              {ORG_TEXT.GO_TO_BOARD}
            </Button>
          ) : null}
          {step.kind === "invalid" || step.kind === "missing" ? (
            <Button asChild variant="outline">
              <Link href="/">{ORG_TEXT.GO_TO_BOARD}</Link>
            </Button>
          ) : null}
        </CardFooter>
      </Card>
    </main>
  )
}
