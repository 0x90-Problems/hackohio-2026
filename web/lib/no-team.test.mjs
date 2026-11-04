import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { NO_TEAM } from "../../shared/names.ts"
import { isNoTeamError, onNoTeam, teamsOf } from "./no-team.ts"

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8")

test("a new signup (team '' and no teams) is on no team", () => {
  assert.equal(onNoTeam({ team: "", teams: [] }), true)
  assert.equal(onNoTeam({ team: "" }), true)
})

test("anyone on a team, or an org admin, is not shown the no-team message", () => {
  assert.equal(onNoTeam({ team: "Alpha", teams: ["Alpha"] }), false)
  assert.equal(onNoTeam({ team: "Alpha" }), false) // an older row with only team
  assert.equal(onNoTeam({ team: "", teams: ["Beta"] }), false)
  assert.equal(onNoTeam({ team: "", teams: [], admin: true }), false)
  assert.equal(onNoTeam({ team: "", teams: [] }, true), false)
})

test("until their row loads we don't guess", () => {
  assert.equal(onNoTeam(undefined), null)
  assert.equal(onNoTeam(null), null)
})

test("teamsOf prefers teams, then falls back to team", () => {
  assert.deepEqual(teamsOf({ team: "Alpha", teams: ["Alpha", "Beta"] }), ["Alpha", "Beta"])
  assert.deepEqual(teamsOf({ team: "Alpha" }), ["Alpha"])
  assert.deepEqual(teamsOf({ team: "" }), [])
})

test("only the no_team code from Folders or Chat counts as no team", () => {
  const err = (code, status = 403) => Object.assign(new Error("x"), { code, status })
  assert.equal(isNoTeamError(err(NO_TEAM.CODE), NO_TEAM.CODE), true)
  assert.equal(isNoTeamError(err("not_on_team"), NO_TEAM.CODE), false) // a team they left: retry without it
  assert.equal(isNoTeamError(err("forbidden"), NO_TEAM.CODE), false)
  assert.equal(isNoTeamError(new Error("no_team"), NO_TEAM.CODE), false)
  assert.equal(isNoTeamError(null, NO_TEAM.CODE), false)
})

test("NO_TEAM is in names.ts and names.json alike, and says what to do", () => {
  const json = JSON.parse(read("../../shared/names.json")).no_team
  assert.deepEqual(json, { code: NO_TEAM.CODE, title: NO_TEAM.TITLE, hint: NO_TEAM.HINT })
  assert.equal(`${NO_TEAM.TITLE} ${NO_TEAM.HINT}`, "You're not on a team yet. Ask an admin to invite you.")
})

test("the signup form has no Team box and signUp sends no team", () => {
  const screen = read("../components/auth/auth-screen.tsx")
  assert.equal(/name="team"|htmlFor="team"/.test(screen), false)
  const auth = read("./board-auth.ts")
  assert.equal(/team/.test(auth.slice(auth.indexOf("export function signUp"), auth.indexOf("export function signUp") + 600)), false)
})
