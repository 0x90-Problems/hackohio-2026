// What an open browser takes from the board on each refresh. A browser that kept its old columns
// would send them back on its next edit, and that save replaces the whole list, so a column someone
// else added would be lost.

import type { Project } from "@/lib/types"

const columnsOf = (project: Project) =>
  JSON.stringify(
    [...project.categories]
      .sort((a, b) => a.order - b.order)
      .map(({ slug, name, color, order }) => ({ slug, name, color, order })),
  )

function refreshedProject(local: Project, remote: Project): Project {
  const same =
    local.name === remote.name &&
    local.description === remote.description &&
    local.team === remote.team &&
    Boolean(local.unassigned) === Boolean(remote.unassigned) &&
    Boolean(local.archived) === Boolean(remote.archived) &&
    local.approval === remote.approval &&
    columnsOf(local) === columnsOf(remote)
  if (same) return local
  const next: Project = { ...local, name: remote.name, team: remote.team, categories: remote.categories }
  delete next.description
  delete next.unassigned
  delete next.archived
  delete next.approval
  if (remote.approval) next.approval = remote.approval
  if (remote.description) next.description = remote.description
  if (remote.unassigned) next.unassigned = true
  if (remote.archived) next.archived = true
  return next
}

/** The same array when nothing changed, so a refresh with no news doesn't redraw the page. */
export function refreshedProjects(current: Project[], remote: Project[]): Project[] {
  const byKey = new Map(remote.map((project) => [project.key, project]))
  let changed = false
  const next = current.map((project) => {
    const incoming = byKey.get(project.key)
    const updated = incoming ? refreshedProject(project, incoming) : project
    if (updated !== project) changed = true
    return updated
  })
  return changed ? next : current
}
