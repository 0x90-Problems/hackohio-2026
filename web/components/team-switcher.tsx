"use client"

import { useEffect, useState } from "react"

import { ORG_TEXT } from "@/shared/names"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { foldersApi } from "@/lib/folders-api"
import { activeTeams, multiOrgOn } from "@/lib/org-choice"
import { chooseTeam } from "@/lib/team-choice"
import { switchTo, useOrgs } from "@/lib/use-orgs"

// Which team you're working in, for anyone on more than one. Everyone else sees `fallback`.
export function TeamSwitcher({ className, fallback = null }: { className?: string; fallback?: React.ReactNode }) {
  return multiOrgOn() ? <OrgTeamSwitcher className={className} fallback={fallback} /> : <NamedTeamSwitcher className={className} fallback={fallback} />
}

function NamedTeamSwitcher({ className, fallback = null }: { className?: string; fallback?: React.ReactNode }) {
  const [current, setCurrent] = useState<{ team: string; teams: string[] } | null>(null)

  useEffect(() => {
    let cancelled = false
    foldersApi
      .workspace()
      .then((ws) => !cancelled && setCurrent({ team: ws.team_name, teams: ws.teams ?? [ws.team_name] }))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  if (!current || current.teams.length < 2) return fallback

  return (
    <Select
      value={current.team}
      onValueChange={(team) => {
        chooseTeam(team)
        // Start clean: what's open or cached belongs to the old team, including this URL's folder.
        window.location.assign(window.location.pathname)
      }}
    >
      <SelectTrigger aria-label="Team" className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {current.teams.map((team) => (
          <SelectItem key={team} value={team}>
            {team}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// With several orgs: the active org's teams by id, the same choice as the top bar's switcher.
function OrgTeamSwitcher({ className, fallback = null }: { className?: string; fallback?: React.ReactNode }) {
  const state = useOrgs()
  if (state.status !== "ready" || !state.org || !state.team || activeTeams(state.org.teams).length < 2) return fallback
  const { org, team, choice } = state
  return (
    <Select value={team.team_id} onValueChange={(next) => switchTo({ org: org.org_id, team: next }, choice)}>
      <SelectTrigger aria-label={ORG_TEXT.TEAMS_HEADING} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {activeTeams(org.teams).map((row) => (
          <SelectItem key={row.team_id} value={row.team_id}>
            {row.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
