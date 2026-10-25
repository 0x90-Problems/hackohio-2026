import type { ProjectTemplate as ProjectTemplateId } from "@/shared/names"
import type { Category, ProjectLayout } from "@/lib/types"
import catalog from "@/lib/project-templates.json"
import { makeSlug, type CategoryColor, CATEGORY_COLOR_NAMES } from "@/lib/categories"

// GitHub's new-project gallery, kept as project-templates.json so the API,
// MCP server, and cloud config can carry the same catalog.
// Column sets follow GitHub's published templates where those exist:
// - Blank board: the gallery copy names Backlog, In progress, and Done.
// - Team planning: Backlog, Ready, In progress, In review, Done, plus the
//   Iteration and Estimate fields and Priority options High / Medium / Low
//   from https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/quickstart-for-projects
// - Kanban: Todo, In progress, Done, with a WIP mark on In progress.
// - Bug tracker: Todo, High priority, Low priority, Closed, from GitHub's
//   bug triage template (https://docs.github.com/en/enterprise-server@3.1/github/managing-your-work-on-github/about-project-boards).
//   The live projects/new gallery requires a signed-in session, so Feature
//   release, Iterative development, and Product launch use the task's
//   GitHub-shaped flows where the public docs do not list status options.
// Roadmap columns and "No milestones yet", and the retrospective columns,
// match the gallery copy the product ships.
const LAYOUTS = new Set<string>(["board", "table", "roadmap"])

function templateLayout(layout: string, templateId: string): ProjectLayout {
  if (!LAYOUTS.has(layout)) {
    throw new Error(`Template ${templateId} has unknown layout ${layout}`)
  }
  return layout as ProjectLayout
}

export type ProjectTemplate = {
  id: ProjectTemplateId
  name: string
  description: string
  footer: string
  layout: ProjectLayout
  columns: { name: string; color: CategoryColor }[]
  tags: string[]
  fields: string[]
  wipColumn?: string
}

const COLORS = new Set<string>(CATEGORY_COLOR_NAMES)

function columnColor(color: string, templateId: string, name: string): CategoryColor {
  if (!COLORS.has(color)) {
    throw new Error(`Template ${templateId} column ${name} has unknown color ${color}`)
  }
  return color as CategoryColor
}

export const PRODUCT_NAME = catalog.productName
export const PICKER_TITLE = catalog.picker.title
export const PICKER_DESCRIPTION = catalog.picker.description

export const PROJECT_TEMPLATES: ProjectTemplate[] = catalog.templates.map((template) => ({
  id: template.id as ProjectTemplateId,
  name: template.name,
  description: template.description,
  footer: template.footer,
  layout: templateLayout(template.layout, template.id),
  columns: template.columns.map((column) => ({
    name: column.name,
    color: columnColor(column.color, template.id, column.name),
  })),
  tags: [...template.tags],
  fields: [...template.fields],
  ...("wipColumn" in template && template.wipColumn ? { wipColumn: template.wipColumn } : {}),
}))

export const getTemplate = (id: string) =>
  PROJECT_TEMPLATES.find((template) => template.id === id) ?? PROJECT_TEMPLATES[0]

export function templateCategories(template: ProjectTemplate): Category[] {
  const slugs: string[] = []
  return template.columns.map(({ name, color }, order) => {
    const slug = makeSlug(name, slugs)
    slugs.push(slug)
    return { slug, name, color, order }
  })
}
