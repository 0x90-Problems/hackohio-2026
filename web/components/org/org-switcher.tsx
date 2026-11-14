"use client"

import { useState } from "react"

import { ORG_TEXT } from "@/shared/names"
import { Building2Icon, CheckIcon, ChevronsUpDownIcon, PlusIcon, UsersIcon } from "@/components/icons"
import { activeTeams } from "@/lib/org-choice"
import { switchTo, useOrgs } from "@/lib/use-orgs"
import { CreateOrgDialog } from "@/components/org/create-org"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// The top bar's org and team picker (NEXT_PUBLIC_MULTI_ORG), beside the user menu. Orgs first, then
// the active org's teams (only that org's; no other org's team names are ever listed), then Create organization.
// The choice is per browser (lib/org-choice.ts).
export function OrgSwitcher() {
  const state = useOrgs()
  const [creating, setCreating] = useState(false)

  if (state.status !== "ready" || !state.org) return null
  const { orgs, org, team, choice } = state
  const current = team ? `${org.name} / ${team.name}` : org.name

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {/* Compact, beside the user menu: org over team, truncated (full names on hover), icon only on phones. */}
          <Button
            variant="ghost"
            className="h-10 min-w-0 max-w-56 shrink gap-2 rounded-lg px-2"
            aria-label={`${ORG_TEXT.SWITCHER_LABEL}: ${current}`}
            title={current}
          >
            <Building2Icon aria-hidden="true" />
            <span className="hidden min-w-0 flex-col items-start text-left leading-tight sm:flex">
              <span className="max-w-full truncate text-sm font-medium">{org.name}</span>
              {team ? <span className="max-w-full truncate text-xs font-normal text-muted-foreground">{team.name}</span> : null}
            </span>
            <ChevronsUpDownIcon className="text-muted-foreground" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-xs text-muted-foreground">{ORG_TEXT.ORGS_HEADING}</DropdownMenuLabel>
          {orgs.map((row) => (
            <DropdownMenuItem
              key={row.org_id}
              onSelect={() => {
                if (row.org_id === org.org_id) return
                switchTo({ org: row.org_id, team: row.default_team_id || activeTeams(row.teams)[0]?.team_id || "" }, choice)
              }}
            >
              <Building2Icon aria-hidden="true" />
              <span className="truncate">{row.name}</span>
              {row.org_id === org.org_id ? <CheckIcon className="ml-auto" aria-label={ORG_TEXT.CURRENT} /> : null}
            </DropdownMenuItem>
          ))}
          {activeTeams(org.teams).length > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">{ORG_TEXT.TEAMS_HEADING}</DropdownMenuLabel>
              {activeTeams(org.teams).map((row) => (
                <DropdownMenuItem
                  key={row.team_id}
                  onSelect={() => {
                    if (row.team_id === team?.team_id) return
                    switchTo({ org: org.org_id, team: row.team_id }, choice)
                  }}
                >
                  <UsersIcon aria-hidden="true" />
                  <span className="truncate">{row.name}</span>
                  {row.team_id === team?.team_id ? <CheckIcon className="ml-auto" aria-label={ORG_TEXT.CURRENT} /> : null}
                </DropdownMenuItem>
              ))}
            </>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setCreating(true)}>
            <PlusIcon aria-hidden="true" />
            {ORG_TEXT.CREATE}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CreateOrgDialog open={creating} onOpenChange={setCreating} />
    </>
  )
}
