// Who can move a project to another team, and who that shuts out. The same rules as the
// board API (setProjectTeam and canSeeProject in the backend). The board still decides, so
// this only avoids offering what it would refuse.

import type { SiteState } from "@/lib/site-db"

type MovingProject = { team: string; unassigned?: boolean }
type Person = SiteState["users"][number]

const teamsOf = (person: Pick<Person, "team" | "teams">) => person.teams ?? (person.team ? [person.team] : [])

/** An org admin, or a manager of the project's team. A project with no team is admins only. Null if you can't, or there's nowhere to go. */
export function moveOptions(project: MovingProject, site: Pick<SiteState, "teams" | "users">, userId: string, adminInSession: boolean) {
  const me = site.users.find((user) => user._id === userId)
  const isAdmin = adminInSession || me?.admin === true
  const manages = !project.unassigned && site.teams.some((team) => team.name === project.team && team.managers.includes(userId))
  if (!isAdmin && !manages) return null
  const targets = site.teams
    .map((team) => team.name)
    .filter((name) => project.unassigned || name !== project.team)
    .sort((a, b) => a.localeCompare(b))
  return targets.length > 0 ? { targets, isAdmin, myTeams: me ? teamsOf(me) : [] } : null
}

/** Who can see it now but won't on `target`. Admins see every project, and a project with no team is open to everyone. */
export function peopleLosingAccess(project: MovingProject, users: SiteState["users"], target: string) {
  return users.filter(
    (user) => !user.admin && !teamsOf(user).includes(target) && (project.unassigned || teamsOf(user).includes(project.team))
  )
}
