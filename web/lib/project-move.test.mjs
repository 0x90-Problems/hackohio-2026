import assert from "node:assert/strict"
import test from "node:test"
import { moveOptions, peopleLosingAccess } from "./project-move.ts"

const person = (_id, teams, extra = {}) => ({ _id, name: _id, auth_username: _id, team: teams[0] ?? "", teams, ...extra })
const site = {
  teams: [
    { name: "Alpha", managers: ["manager"] },
    { name: "Gamma", managers: [] },
    { name: "Beta", managers: ["other"] },
  ],
  users: [
    person("admin", [], { admin: true }),
    person("manager", ["Alpha"]),
    person("member", ["Alpha"]),
    person("both", ["Alpha", "Beta"]),
    person("other", ["Beta"]),
  ],
}
const onAlpha = { team: "Alpha" }
const noTeam = { team: "Alpha", unassigned: true } // listed under Alpha, but the board has no team for it

test("an org admin can move any project, to any other team", () => {
  assert.deepEqual(moveOptions(onAlpha, site, "admin", false)?.targets, ["Beta", "Gamma"])
  assert.equal(moveOptions(onAlpha, site, "admin", false)?.isAdmin, true)
})

test("being an admin in the session counts, for someone the directory doesn't mark yet", () => {
  assert.equal(moveOptions(onAlpha, site, "member", true)?.isAdmin, true)
})

test("a manager of the project's team can move it, and may send it to a team they aren't on", () => {
  const options = moveOptions(onAlpha, site, "manager", false)
  assert.deepEqual(options?.targets, ["Beta", "Gamma"])
  assert.deepEqual(options?.myTeams, ["Alpha"])
})

test("nobody else is offered it, the same people the board refuses", () => {
  assert.equal(moveOptions(onAlpha, site, "member", false), null)
  assert.equal(moveOptions(onAlpha, site, "other", false), null) // manages a different team
  assert.equal(moveOptions(onAlpha, site, "stranger", false), null)
})

test("a project with no team is admins only, even for a manager of the team it's listed under", () => {
  assert.equal(moveOptions(noTeam, site, "manager", false), null)
  assert.deepEqual(moveOptions(noTeam, site, "admin", false)?.targets, ["Alpha", "Beta", "Gamma"])
})

test("with nowhere to go there's nothing to offer", () => {
  assert.equal(moveOptions(onAlpha, { teams: [site.teams[0]], users: site.users }, "manager", false), null)
})

test("accounts from before multiple teams only have `team`", () => {
  const older = { teams: site.teams, users: [{ _id: "old", name: "old", auth_username: "old", team: "Alpha" }] }
  assert.deepEqual(peopleLosingAccess(onAlpha, older.users, "Beta").map((user) => user._id), ["old"])
  assert.deepEqual(peopleLosingAccess(onAlpha, older.users, "Alpha"), [])
})

test("people on the old team who aren't on the new one lose access; admins and people on both don't", () => {
  assert.deepEqual(peopleLosingAccess(onAlpha, site.users, "Beta").map((user) => user._id), ["manager", "member"])
})

test("moving a project with no team shuts out everyone not on the new team", () => {
  assert.deepEqual(peopleLosingAccess(noTeam, site.users, "Beta").map((user) => user._id), ["manager", "member"])
  assert.deepEqual(peopleLosingAccess(noTeam, site.users, "Gamma").map((user) => user._id), ["manager", "member", "both", "other"])
})
