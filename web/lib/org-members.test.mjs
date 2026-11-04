import assert from "node:assert/strict"
import test from "node:test"
import { lastActiveOf, orgCounts, orgMembers, roleOf, teamsOf } from "./org-members.ts"

const person = (_id, extra = {}) => ({ _id, name: _id, auth_username: _id, team: "", teams: [], ...extra })
const agent = (_id, owner_id, extra = {}) => ({ _id, owner_id, revoked: false, ...extra })

const site = {
  teams: [
    { name: "Core", managers: ["mia"] },
    { name: "Design", managers: [] },
    { name: "Ops", managers: ["mia"] },
  ],
  users: [
    person("zed", { admin: true, teams: ["Core"] }),
    person("mia", { teams: ["Core", "Ops"] }),
    person("ann", { teams: [] }),
  ],
}
const agents = [
  agent("a1", "zed"),
  agent("a2", "zed"),
  agent("a3", "zed"),
  agent("a4", "mia"),
  agent("a5", "mia"),
  agent("a6", "ann", { revoked: true }),
]

test("counts come from the board: teams, people and agents that aren't revoked", () => {
  assert.deepEqual(orgCounts(site, agents), { teams: 3, people: 3, agents: 5 })
})

test("an older team name someone still carries counts as a team, once", () => {
  const legacy = { teams: [{ name: "Core", managers: [] }], users: [person("a", { team: "Core", teams: undefined }), person("b", { team: "Old", teams: undefined })] }
  assert.deepEqual(orgCounts(legacy, []), { teams: 2, people: 2, agents: 0 })
  assert.deepEqual(teamsOf({ team: "Old" }), ["Old"])
  assert.deepEqual(teamsOf({ team: "" }), [])
})

test("org admin beats team manager beats member", () => {
  assert.equal(roleOf(site.users[0], site.teams), "admin")
  assert.equal(roleOf(person("zed", { admin: true }), [{ name: "X", managers: ["zed"] }]), "admin")
  assert.equal(roleOf(site.users[1], site.teams), "manager")
  assert.equal(roleOf(site.users[2], site.teams), "member")
})

test("members list: role order, teams, managed teams and live agent counts", () => {
  const members = orgMembers(site, agents)
  assert.deepEqual(
    members.map((m) => [m.person._id, m.role, m.teams, m.managerOf, m.agents]),
    [
      ["zed", "admin", ["Core"], [], 3],
      ["mia", "manager", ["Core", "Ops"], ["Core", "Ops"], 2],
      ["ann", "member", [], [], 0],
    ]
  )
})

test("last active is the latest thing they or their agents did, or null", () => {
  const traces = [
    { actor: { type: "human", id: "mia" }, created_at: new Date("2026-11-01T10:00:00Z") },
    { author: { type: "agent", id: "a4", acting_for: "mia" }, created_at: new Date("2026-11-02T10:00:00Z") },
    { created_by: { type: "human", id: "zed" }, created_at: new Date("2026-10-30T10:00:00Z") },
  ]
  assert.equal(lastActiveOf("mia", traces, agents)?.toISOString(), "2026-11-02T10:00:00.000Z")
  assert.equal(lastActiveOf("zed", traces, agents)?.toISOString(), "2026-10-30T10:00:00.000Z")
  assert.equal(lastActiveOf("ann", traces, agents), null)
})

test("an agent's last use counts when the board sends it, and bad dates are ignored", () => {
  const used = [agent("a1", "ann", { last_used_at: "2026-11-03T08:00:00Z" }), agent("a2", "ann", { last_used_at: "nope" })]
  assert.equal(lastActiveOf("ann", [], used)?.toISOString(), "2026-11-03T08:00:00.000Z")
  assert.equal(lastActiveOf("ann", [], [agent("a3", "ann", { last_used_at: null })]), null)
})
