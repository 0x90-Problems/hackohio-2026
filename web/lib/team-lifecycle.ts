// NSB-73: archived and deleted teams. Dependency-free so node --test can load it.

type TeamLike = { name: string; team_id?: string; archived_at?: Date | string }

/** Active teams (cards) and archived ones (the Archived section), each keeping the given order. */
export function splitTeams<T extends TeamLike>(teams: readonly T[]): { active: T[]; archived: T[] } {
  return {
    active: teams.filter((team) => !team.archived_at),
    archived: teams.filter((team) => Boolean(team.archived_at)),
  }
}

/** How the board names a team in a path: its id when it has one, else its name (organizations off). */
export function teamRef(team: TeamLike): string {
  return team.team_id || team.name
}

/** Deleting asks for the team's name, typed exactly (spaces at the ends don't count). */
export function deleteConfirmed(typed: string, name: string): boolean {
  return typed.trim() === name && name.length > 0
}
