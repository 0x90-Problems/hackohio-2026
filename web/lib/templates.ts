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
  previewProject: string
  columns: { name: string; color: CategoryColor }[]
  previewTickets: string[][]
  tags: string[]
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "blank",
    name: "Blank board",
    description: "A clean board, ready to customize.",
    previewProject: "Website refresh",
    columns: DEFAULT_CATEGORIES.map(({ name, color }) => ({ name, color })),
    previewTickets: [
      ["Define project goals", "Collect page ideas"],
      ["Draft landing page", "Build navigation"],
      ["Review content outline"],
      ["Publish project brief"],
    ],
    tags: [],
  },
  {
    id: "team-planning",
    name: "Team planning",
    description: "Organize team work across cycles.",
    previewProject: "Team sprint plan",
    columns: [
      { name: "Backlog", color: "gray" },
      { name: "Ready", color: "teal" },
      { name: "In progress", color: "amber" },
      { name: "In review", color: "orange" },
      { name: "Done", color: "green" },
    ],
    previewTickets: [
      ["Plan sprint capacity", "Refine backlog"],
      ["Update design system"],
      ["Build onboarding flow", "Add account settings"],
      ["Review sprint demo"],
      ["Ship profile editor"],
    ],
    tags: ["Feature", "Chore", "Bug"],
  },
  {
    id: "kanban",
    name: "Kanban",
    description: "Track flow and limit work in progress.",
    previewProject: "Customer portal",
    columns: [
      { name: "Todo", color: "gray" },
      { name: "In progress", color: "amber" },
      { name: "Done", color: "green" },
    ],
    previewTickets: [
      ["Map account journey", "Gather user feedback"],
      ["Build billing page", "Add usage dashboard"],
      ["Launch account portal"],
    ],
    tags: ["Blocked"],
  },
  {
    id: "feature-release",
    name: "Feature release",
    description: "Prioritize work for a feature release.",
    previewProject: "Smart search launch",
    columns: [
      { name: "Backlog", color: "gray" },
      { name: "Ready", color: "teal" },
      { name: "In progress", color: "amber" },
      { name: "In review", color: "orange" },
      { name: "Done", color: "green" },
    ],
    previewTickets: [
      ["Add saved searches", "Define launch scope"],
      ["Design search filters"],
      ["Build query suggestions", "Add result ranking"],
      ["Review release notes"],
      ["Ship search updates"],
    ],
    tags: ["Must have", "Nice to have", "Release blocker"],
  },
  {
    id: "bug-tracker",
    name: "Bug tracker",
    description: "Triage bugs through resolution.",
    previewProject: "Mobile app bugs",
    columns: [
      { name: "New", color: "red" },
      { name: "Triaged", color: "orange" },
      { name: "In progress", color: "amber" },
      { name: "Fixed", color: "green" },
    ],
    previewTickets: [
      ["Checkout screen freezes", "Images fail to load"],
      ["Confirm payment issue", "Reproduce login loop"],
      ["Fix retry handling", "Patch session timeout"],
      ["Verify app update"],
    ],
    tags: ["Bug", "P0", "P1", "P2"],
  },
  {
    id: "iterative-development",
    name: "Iterative development",
    description: "Plan work across iterations.",
    previewProject: "Mobile app v2",
    columns: [
      { name: "Backlog", color: "gray" },
      { name: "This iteration", color: "teal" },
      { name: "In progress", color: "amber" },
      { name: "Done", color: "green" },
    ],
    previewTickets: [
      ["Explore offline mode", "Write upgrade guide"],
      ["Build sync queue", "Design empty states"],
      ["Test background sync"],
      ["Release beta build", "Document API changes"],
    ],
    tags: ["Iteration 1", "Iteration 2"],
  },
  {
    id: "product-launch",
    name: "Product launch",
    description: "Coordinate work for a product launch.",
    previewProject: "Spring product launch",
    columns: [
      { name: "Planning", color: "gray" },
      { name: "In progress", color: "amber" },
      { name: "Ready to launch", color: "teal" },
      { name: "Launched", color: "green" },
    ],
    previewTickets: [
      ["Approve launch plan", "Finalize pricing"],
      ["Prepare launch email", "Build signup flow"],
      ["Complete launch checklist", "Train support team"],
      ["Announce new product", "Publish launch page"],
    ],
    tags: ["Design", "Engineering", "Marketing"],
  },
  {
    id: "roadmap",
    name: "Roadmap",
    description: "Group work by time horizon.",
    previewProject: "Platform roadmap",
    columns: [
      { name: "Now", color: "red" },
      { name: "Next", color: "amber" },
      { name: "Later", color: "gray" },
    ],
    previewTickets: [
      ["Improve load times", "Add audit log"],
      ["Ship team workspaces", "Expand integrations"],
      ["Explore mobile client", "Research automation"],
    ],
    tags: ["Q4", "Q1"],
  },
  {
    id: "team-retrospective",
    name: "Team retrospective",
    description: "Reflect, improve, and take action.",
    previewProject: "Sprint 12 retro",
    columns: [
      { name: "Went well", color: "green" },
      { name: "To improve", color: "orange" },
      { name: "Action items", color: "pink" },
    ],
    previewTickets: [
      ["Fast code reviews", "Clear sprint goals"],
      ["Too many handoffs", "Late scope changes"],
      ["Pair on complex work", "Set mid-sprint check-in"],
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
