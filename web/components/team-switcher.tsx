"use client"

import { useEffect, useState } from "react"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { foldersApi } from "@/lib/folders-api"
import { chooseTeam } from "@/lib/team-choice"

// Which team you're working in, for anyone on more than one. Everyone else sees `fallback`.
export function TeamSwitcher({ className, fallback = null }: { className?: string; fallback?: React.ReactNode }) {
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
