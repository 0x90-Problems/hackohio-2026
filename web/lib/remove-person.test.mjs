import assert from "node:assert/strict"
import test from "node:test"
import { canRemovePerson, removalSummary } from "./remove-person.ts"

const person = (_id, extra = {}) => ({ _id, name: _id, auth_username: _id, team: "", teams: [], ...extra })
const users = [person("admin", { admin: true }), person("member"), person("other")]

test("only an org admin is offered Remove", () => {
  assert.equal(canRemovePerson(users[1], users, "admin", true), true)
  assert.equal(canRemovePerson(users[1], users, "other", false), false)
  assert.equal(canRemovePerson(users[1], users, undefined, true), false)
})

test("nobody is offered removing themselves", () => {
  assert.equal(canRemovePerson(users[0], users, "admin", true), false)
})

test("the last admin isn't offered, another admin is", () => {
  const solo = [person("a", { admin: true }), person("b")]
  // b is an admin in this session only (not yet marked), a is the only marked admin.
  assert.equal(canRemovePerson(solo[0], solo, "b", true), false)
  const two = [person("a", { admin: true }), person("b", { admin: true })]
  assert.equal(canRemovePerson(two[0], two, "b", true), true)
})

test("the confirm text says how many agents and tokens stop working", () => {
  assert.match(removalSummary("Naz", { agents: 1, tokens: 3 }), /^1 agent and 3 tokens stop working right away\. Naz comes off every team/)
  assert.match(removalSummary("Naz", { agents: 2, tokens: 1 }), /^2 agents and 1 token stop/)
  assert.match(removalSummary("Naz", { agents: 0, tokens: 0 }), /^Naz has no agents or live tokens\./)
  assert.match(removalSummary("Naz", null), /^Their agents and tokens stop working right away\./)
})
