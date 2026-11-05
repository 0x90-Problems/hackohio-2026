"use client"

import { useState } from "react"

import { ORG_TEXT } from "@/shared/names"
import { Building2Icon, CheckIcon, ChevronsUpDownIcon, PlusIcon, UsersIcon } from "@/components/icons"
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

// The top bar's org and team picker (NEXT_PUBLIC_MULTI_ORG). Orgs first, then the active org's
// teams (only that org's; no other org's team names are ever listed), then Create organization.
// The choice is per browser (lib/org-choice.ts).
export function OrgSwitcher() {
  const state = useOrgs()
  const [creating, setCreating] = useState(false)

  if (state.status !== "ready" || !state.org) return null
  const { orgs, org, team, choice } = state

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="max-w-64 gap-1.5" aria-label={ORG_TEXT.SWITCHER_LABEL}>
            <Building2Icon aria-hidden="true" />
            <span className="truncate font-medium">{org.name}</span>
            {team ? <span className="hidden truncate text-muted-foreground sm:inline">/ {team.name}</span> : null}
            <ChevronsUpDownIcon className="text-muted-foreground" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-xs text-muted-foreground">{ORG_TEXT.ORGS_HEADING}</DropdownMenuLabel>
          {orgs.map((row) => (
            <DropdownMenuItem
              key={row.org_id}
              onSelect={() => {
                if (row.org_id === org.org_id) return
                switchTo({ org: row.org_id, team: row.default_team_id || row.teams[0]?.team_id || "" }, choice)
              }}
            >
              <Building2Icon aria-hidden="true" />
              <span className="truncate">{row.name}</span>
              {row.org_id === org.org_id ? <CheckIcon className="ml-auto" aria-label={ORG_TEXT.CURRENT} /> : null}
            </DropdownMenuItem>
          ))}
          {org.teams.length > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">{ORG_TEXT.TEAMS_HEADING}</DropdownMenuLabel>
              {org.teams.map((row) => (
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
