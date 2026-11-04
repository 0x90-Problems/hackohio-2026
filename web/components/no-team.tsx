"use client"

import { useEffect, useState } from "react"
import { UsersIcon } from "lucide-react"

import { NO_TEAM } from "@/shared/names"
import { useAuthUser } from "@/components/auth/auth-gate"
import { onNoTeam } from "@/lib/no-team"
import { loadSite } from "@/lib/site-db"
import { cn } from "@/lib/utils"

/** What a page shows someone on no team, in place of an error or an empty team. */
export function NoTeamNotice({ className }: { className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center duration-300 animate-in fade-in motion-reduce:animate-none",
        className
      )}
    >
      <UsersIcon className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="font-medium">{NO_TEAM.TITLE}</p>
      <p className="text-sm text-muted-foreground">{NO_TEAM.HINT}</p>
    </div>
  )
}

/**
 * True when the signed-in person is on no team (and isn't an org admin). Reads their row from
 * the site list rather than the session, so being added to a team shows without signing in again.
 * Null until that has loaded.
 */
export function useOnNoTeam(): boolean | null {
  const account = useAuthUser()
  const [result, setResult] = useState<{ id: string; noTeam: boolean | null } | null>(null)

  useEffect(() => {
    if (!account?._id) return
    let cancelled = false
    void loadSite()
      .then((site) => {
        const me = site.users.find((user) => user._id === account._id)
        if (!cancelled) setResult({ id: account._id, noTeam: onNoTeam(me, account.admin === true) })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [account?._id, account?.admin])

  return result && result.id === account?._id ? result.noTeam : null
}

/** The notice, only for someone on no team. */
export function NoTeamBanner({ className }: { className?: string }) {
  return useOnNoTeam() ? <NoTeamNotice className={className} /> : null
}
