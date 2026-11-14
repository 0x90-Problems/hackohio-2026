import assert from "node:assert/strict"
import test from "node:test"
import { deleteConfirmed, splitTeams, teamRef } from "./team-lifecycle.ts"

test("archived teams go to their own section; order is kept", () => {
  const teams = [
    { name: "Ops", team_id: "team_opsopsopsops" },
    { name: "Old", team_id: "team_oldoldoldold", archived_at: new Date("2026-11-14T00:00:00Z") },
    { name: "Design" },
  ]
  const { active, archived } = splitTeams(teams)
  assert.deepEqual(active.map((team) => team.name), ["Ops", "Design"])
  assert.deepEqual(archived.map((team) => team.name), ["Old"])
})

test("the board is asked by team id, or by name when there's no id", () => {
  assert.equal(teamRef({ name: "Ops", team_id: "team_opsopsopsops" }), "team_opsopsopsops")
  assert.equal(teamRef({ name: "Ops" }), "Ops")
})

test("delete needs the exact team name", () => {
  assert.equal(deleteConfirmed("Old crew", "Old crew"), true)
  assert.equal(deleteConfirmed("  Old crew ", "Old crew"), true)
  assert.equal(deleteConfirmed("old crew", "Old crew"), false)
  assert.equal(deleteConfirmed("", ""), false)
})
