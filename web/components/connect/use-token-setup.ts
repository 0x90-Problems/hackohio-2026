"use client"

// What the Connect agent and Create API key pages need besides the wizard (NSB-68): the
// organization's token expiry, and the organization and team the new token works in.

import { useEffect, useState } from "react"

import { DEFAULT_TOKEN_EXPIRY_HOURS } from "@/shared/names"
import { useAuthUser } from "@/components/auth/auth-gate"
import { loadSite } from "@/lib/site-db"
import { multiOrgOn } from "@/lib/org-choice"
import { useOrgs } from "@/lib/use-orgs"

export type TokenSetup = {
  expiryHours: number
  /** The organization's name, once known. */
  org: string | null
  /** The team's name, once known. */
  team: string | null
}

export function useTokenSetup(): TokenSetup {
  const account = useAuthUser()
  const multiOrg = multiOrgOn()
  const orgs = useOrgs(multiOrg)
  const [site, setSite] = useState<{ expiryHours: number; org: string | null }>({
    expiryHours: DEFAULT_TOKEN_EXPIRY_HOURS,
    org: null,
  })

  useEffect(() => {
    let cancelled = false
    loadSite()
      .then((loaded) => {
        if (cancelled) return
        setSite({
          expiryHours: loaded.organization?.token_expiry_hours || DEFAULT_TOKEN_EXPIRY_HOURS,
          org: loaded.organization?.name || null,
        })
      })
      .catch(() => {
        // Keeps the default expiry; the summary leaves the organization out.
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (multiOrg) {
    // With several organizations the account's team field holds an id, so use the names the org API gives.
    const ready = orgs.status === "ready" ? orgs : null
    return { expiryHours: site.expiryHours, org: ready?.org?.name ?? null, team: ready?.team?.name ?? null }
  }
  return { expiryHours: site.expiryHours, org: site.org, team: account?.team || null }
}
