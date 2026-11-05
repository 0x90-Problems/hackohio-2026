"use client"

import { useEffect, useState } from "react"

import { readSession } from "@/lib/board-auth"
import { createOrgApi, type OrgSummary, type OrgTeam } from "@/lib/org-api"
import { resolveChoice, sameChoice, type OrgChoice } from "@/lib/org-choice"
import { activeOrgChoice, chooseOrg } from "@/lib/team-choice"

// The orgs you're in, and which org and team you're working in (NEXT_PUBLIC_MULTI_ORG only).
// Asked once per page load and shared by the switcher, the onboarding gate and the org pages.

export const orgApi = createOrgApi({
  fetch: (url, init) => fetch(url, init),
  secret: () => readSession()?.secret ?? null,
})

export type OrgState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; orgs: OrgSummary[]; choice: OrgChoice | null; org: OrgSummary | null; team: OrgTeam | null }

let pending: Promise<OrgState> | null = null
const listeners = new Set<(state: OrgState) => void>()

async function load(): Promise<OrgState> {
  const orgs = await orgApi.myOrgs()
  const stored = activeOrgChoice()
  // Nothing picked yet: start where the board already puts you (your default org and team).
  const hint = stored || orgs.length === 0 ? null : await orgApi.membership().then(
    (row) => (row ? { org: row.org_id, team: row.team_id || row.default_team } : null),
    () => null
  )
  const choice = resolveChoice(orgs, stored, hint)
  if (!sameChoice(choice, stored)) {
    chooseOrg(choice)
    // The org you had picked is gone (you left or were removed): what loaded was for it, so start over.
    if (stored && choice?.org !== stored.org && typeof window !== "undefined") window.location.assign("/projects")
  }
  const org = orgs.find((row) => row.org_id === choice?.org) ?? null
  const team = org?.teams.find((row) => row.team_id === choice?.team) ?? null
  return { status: "ready", orgs, choice, org, team }
}

export function loadOrgs(): Promise<OrgState> {
  pending ??= load().catch((): OrgState => ({ status: "error" }))
  return pending
}

/** Ask again (after creating, joining or leaving an org) and tell every hook. */
export function refreshOrgs(): Promise<OrgState> {
  pending = null
  const next = loadOrgs()
  void next.then((state) => listeners.forEach((listener) => listener(state)))
  return next
}

export function useOrgs(enabled = true): OrgState {
  const [state, setState] = useState<OrgState>({ status: "loading" })
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const listener = (next: OrgState) => !cancelled && setState(next)
    listeners.add(listener)
    void loadOrgs().then(listener)
    return () => {
      cancelled = true
      listeners.delete(listener)
    }
  }, [enabled])
  return state
}

/**
 * Work in another org or team. A new org starts clean on its projects (what's open belongs to
 * the old one); a team in the same org reloads this page, like the team switcher always has.
 */
export function switchTo(next: OrgChoice, current: OrgChoice | null, path = "/projects") {
  chooseOrg(next)
  window.location.assign(next.org === current?.org ? window.location.pathname : path)
}
