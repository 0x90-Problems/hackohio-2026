import assert from "node:assert/strict"
import test from "node:test"
import { refreshedProjects } from "./project-refresh.ts"

const column = (slug, order, extra = {}) => ({ slug, name: slug, color: "gray", order, ...extra })
const project = (extra = {}) => ({
  key: "AB",
  name: "Alpha",
  team: "Team",
  layout: "board",
  fields: ["Estimate"],
  categories: [column("backlog", 0), column("done", 1)],
  ...extra,
})

test("nothing new keeps the same array", () => {
  const current = [project()]
  assert.equal(refreshedProjects(current, [project()]), current)
})

test("a column added elsewhere arrives", () => {
  const categories = [column("backlog", 0), column("done", 1), column("qa", 2)]
  const [next] = refreshedProjects([project()], [project({ categories })])
  assert.deepEqual(next.categories.map((c) => c.slug), ["backlog", "done", "qa"])
})

test("renames, colors and order arrive", () => {
  const categories = [column("done", 0, { name: "Shipped" }), column("backlog", 1, { color: "pink" })]
  const [next] = refreshedProjects([project()], [project({ categories })])
  assert.deepEqual(next.categories, categories)
})

test("archive and restore arrive", () => {
  const [archived] = refreshedProjects([project()], [project({ archived: true })])
  assert.equal(archived.archived, true)
  const [restored] = refreshedProjects([archived], [project()])
  assert.equal("archived" in restored, false)
})

test("a move to another team arrives, and clears unassigned", () => {
  const [next] = refreshedProjects([project({ unassigned: true })], [project({ team: "Other" })])
  assert.equal(next.team, "Other")
  assert.equal("unassigned" in next, false)
})

test("what this browser worked out for itself stays", () => {
  const [next] = refreshedProjects([project()], [project({ name: "New name", layout: undefined, fields: [] })])
  assert.equal(next.name, "New name")
  assert.equal(next.layout, "board")
  assert.deepEqual(next.fields, ["Estimate"])
})

test("a project the refresh didn't return is left alone", () => {
  const other = project({ key: "CD" })
  const current = [other]
  assert.equal(refreshedProjects(current, [project()]), current)
})
