import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const root = dirname(fileURLToPath(import.meta.url))

const EXPECTED = {
  blank: [["Backlog", "In progress", "Done"], [], "No dates yet"],
  "team-planning": [["Backlog", "Ready", "In progress", "In review", "Done"], ["High", "Medium", "Low"], "No dates yet"],
  kanban: [["Todo", "In progress", "Done"], [], "No dates yet"],
  "feature-release": [["Backlog", "Prioritized", "In progress", "In review", "Done"], ["Must have", "Should have", "Nice to have"], "No dates yet"],
  "bug-tracker": [["Todo", "High priority", "Low priority", "Closed"], ["Bug"], "No dates yet"],
  "iterative-development": [["Backlog", "Current iteration", "Upcoming"], ["High", "Medium", "Low"], "No dates yet"],
  "product-launch": [["Product", "Design", "Engineering", "Marketing", "Launched"], ["Docs", "Launch blocker"], "No dates yet"],
  roadmap: [["Now", "Next", "Later", "Future"], [], "No milestones yet"],
  "team-retrospective": [["What went well", "What can be improved", "Action items"], [], "No dates yet"],
}

test("template catalog matches the GitHub gallery", () => {
  const catalog = JSON.parse(readFileSync(join(root, "project-templates.json"), "utf8"))
  assert.equal(catalog.productName, "Nutshell")
  assert.equal(catalog.picker.title, "New project")
  assert.match(catalog.picker.description, /columns and some starter tags/)
  assert.deepEqual(catalog.templates.map((item) => item.id), Object.keys(EXPECTED))
  const layouts = {
    blank: "board",
    "team-planning": "table",
    kanban: "board",
    "feature-release": "table",
    "bug-tracker": "table",
    "iterative-development": "board",
    "product-launch": "board",
    roadmap: "roadmap",
    "team-retrospective": "board",
  }
  for (const item of catalog.templates) {
    const [columns, tags, footer] = EXPECTED[item.id]
    assert.deepEqual(item.columns.map((column) => column.name), columns)
    assert.deepEqual(item.tags, tags)
    assert.equal(item.footer, footer)
    assert.equal(item.layout, layouts[item.id])
  }
  const roadmap = catalog.templates.find((item) => item.id === "roadmap")
  assert.deepEqual(roadmap.columns.map((column) => column.name), ["Now", "Next", "Later", "Future"])
  assert.equal(roadmap.footer, "No milestones yet")
})

test("previews sit above the template name in a wide dialog", () => {
  const preview = readFileSync(join(root, "../components/projects/template-preview.tsx"), "utf8")
  assert.match(preview, /minmax\(7\.5rem, 1fr\)/)
  assert.match(preview, /\{column\.name\}/)
  assert.match(preview, /\{template\.footer\}/)
  assert.match(preview, /template\.layout/)
  assert.match(preview, /function TableFrame/)
  assert.doesNotMatch(preview, /truncate/)
  assert.doesNotMatch(preview, /overflow-x-auto/)
  const picker = readFileSync(join(root, "../components/projects/projects-view.tsx"), "utf8")
  assert.match(picker, /PICKER_TITLE/)
  assert.match(picker, /PICKER_DESCRIPTION/)
  assert.match(picker, /sm:max-w-\[calc\(100vw-2rem\)\]/)
  const previewBeforeName = picker.indexOf("<TemplatePreview")
  const nameAfterPreview = picker.indexOf("{t.name}", previewBeforeName)
  assert.ok(previewBeforeName >= 0 && nameAfterPreview > previewBeforeName)
  const catalog = JSON.parse(readFileSync(join(root, "project-templates.json"), "utf8"))
  for (const item of catalog.templates) {
    assert.doesNotMatch(item.description, /\p{Extended_Pictographic}/u)
  }
})

test("user-facing titles use Nutshell", () => {
  const layout = readFileSync(join(root, "../app/layout.tsx"), "utf8")
  const header = readFileSync(join(root, "../components/app-header.tsx"), "utf8")
  const logo = readFileSync(join(root, "../components/logo.tsx"), "utf8")
  assert.match(layout, /PRODUCT_NAME/)
  assert.doesNotMatch(layout, /buck2agents/)
  assert.match(header, /<Logo/)
  assert.match(logo, /PRODUCT_NAME/)
  assert.match(logo, /logo-mark\.png/)
  assert.doesNotMatch(header, /buck2agents/)
})
