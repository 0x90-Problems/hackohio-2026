import type { ProjectTemplate as ProjectTemplateId } from "@/shared/names"
import type { Category } from "@/lib/types"
import {
  DEFAULT_CATEGORIES,
  makeSlug,
  type CategoryColor,
} from "@/lib/categories"

// Starting setups for a new project, modeled on GitHub Projects' featured
// templates. Each one picks the board's columns and some starter tags.
// Columns named Backlog / In progress / In review / Done get the shared
// status slugs, so Approve and Request changes keep working.
export type ProjectTemplate = {
  id: ProjectTemplateId
  name: string
  description: string
  columns: { name: string; color: CategoryColor }[]
  tags: string[]
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "blank",
    name: "Blank board",
    description: "A clean board, ready to customize.",
    columns: DEFAULT_CATEGORIES.map(({ name, color }) => ({ name, color })),
    tags: [],
  },
  {
    id: "team-planning",
    name: "Team planning",
    description: "Organize team work across cycles.",
    columns: [
      { name: "Backlog", color: "gray" },
      { name: "Ready", color: "teal" },
      { name: "In progress", color: "amber" },
      { name: "In review", color: "orange" },
      { name: "Done", color: "green" },
    ],
    tags: ["Feature", "Chore", "Bug"],
  },
  {
    id: "kanban",
    name: "Kanban",
    description: "Track flow and limit work in progress.",
    columns: [
      { name: "Todo", color: "gray" },
      { name: "In progress", color: "amber" },
      { name: "Done", color: "green" },
    ],
    tags: ["Blocked"],
  },
  {
    id: "feature-release",
    name: "Feature release",
    description: "Prioritize work for a feature release.",
    columns: [
      { name: "Backlog", color: "gray" },
      { name: "Ready", color: "teal" },
      { name: "In progress", color: "amber" },
      { name: "In review", color: "orange" },
      { name: "Done", color: "green" },
    ],
    tags: ["Must have", "Nice to have", "Release blocker"],
  },
  {
    id: "bug-tracker",
    name: "Bug tracker",
    description: "Triage bugs through resolution.",
    columns: [
      { name: "New", color: "red" },
      { name: "Triaged", color: "orange" },
      { name: "In progress", color: "amber" },
      { name: "Fixed", color: "green" },
    ],
    tags: ["Bug", "P0", "P1", "P2"],
  },
  {
    id: "iterative-development",
    name: "Iterative development",
    description: "Plan work across iterations.",
    columns: [
      { name: "Backlog", color: "gray" },
      { name: "This iteration", color: "teal" },
      { name: "In progress", color: "amber" },
      { name: "Done", color: "green" },
    ],
    tags: ["Iteration 1", "Iteration 2"],
  },
  {
    id: "product-launch",
    name: "Product launch",
    description: "Coordinate work for a product launch.",
    columns: [
      { name: "Planning", color: "gray" },
      { name: "In progress", color: "amber" },
      { name: "Ready to launch", color: "teal" },
      { name: "Launched", color: "green" },
    ],
    tags: ["Design", "Engineering", "Marketing"],
  },
  {
    id: "roadmap",
    name: "Roadmap",
    description: "Group work by time horizon.",
    columns: [
      { name: "Now", color: "red" },
      { name: "Next", color: "amber" },
      { name: "Later", color: "gray" },
    ],
    tags: ["Q4", "Q1"],
  },
  {
    id: "team-retrospective",
    name: "Team retrospective",
    description: "Reflect, improve, and take action.",
    columns: [
      { name: "Went well", color: "green" },
      { name: "To improve", color: "orange" },
      { name: "Action items", color: "pink" },
    ],
    tags: [],
  },
]

export const getTemplate = (id: string) =>
  PROJECT_TEMPLATES.find((t) => t.id === id) ?? PROJECT_TEMPLATES[0]

// The template's columns as board categories
export function templateCategories(template: ProjectTemplate): Category[] {
  const slugs: string[] = []
  return template.columns.map(({ name, color }, order) => {
    const slug = makeSlug(name, slugs)
    slugs.push(slug)
    return { slug, name, color, order }
  })
}
