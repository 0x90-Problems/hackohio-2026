// Someone on no team: a new signup, until an admin adds them. The board shows them no team's
// projects, and Folders and Chat refuse them with the no_team code. Pages use these to show
// NO_TEAM's message (shared/names) instead of an error or another team's name.
// No imports, so lib/no-team.test.mjs can run it with plain node.

type Member = { team?: string; teams?: string[]; admin?: boolean }

export const teamsOf = (person: Pick<Member, "team" | "teams">) => person.teams ?? (person.team ? [person.team] : [])

/**
 * True when they're on no team and not an org admin (an admin sees every team's work).
 * Null while we don't know yet: their row hasn't loaded, or isn't in the list.
 */
export function onNoTeam(me: Member | null | undefined, adminInSession = false): boolean | null {
  if (!me) return null
  if (adminInSession || me.admin === true) return false
  return teamsOf(me).length === 0
}

/** The error Folders and Chat give someone on no team. Pass NO_TEAM.CODE from shared/names. */
export function isNoTeamError(error: unknown, code: string): boolean {
  if (error === null || typeof error !== "object") return false
  return (error as { code?: unknown }).code === code
}
