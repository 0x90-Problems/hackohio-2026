"use client"

import { multiOrgOn } from "@/lib/org-choice"
import { validInviteToken } from "@/lib/org-api"

// An invite opened while signed out: kept in this tab (sessionStorage, like the session) so
// signing in or up comes back to /invite with it. Never put in the address or sent anywhere else.
const KEY = "nutshell.pending-invite"

export function holdInvite(token: string) {
  try {
    if (validInviteToken(token)) sessionStorage.setItem(KEY, token)
  } catch {
    // they'll need to open the link again after signing in
  }
}

export function heldInvite(): string {
  try {
    const token = sessionStorage.getItem(KEY) ?? ""
    return validInviteToken(token) ? token : ""
  } catch {
    return ""
  }
}

export function dropInvite() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // nothing held
  }
}

/** Where signing in or up goes: back to a held invite (flag on), else home as always. */
export function afterSignInPath(): string {
  return multiOrgOn() && heldInvite() ? "/invite" : "/"
}
