import assert from "node:assert/strict"
import test from "node:test"
import { agentAccess, readAgentUsage, withKeyUsage } from "./agent-usage.ts"

test("readAgentUsage reads last_used_at and expired from a GET /agents row", () => {
  const usage = readAgentUsage({ _id: "agent_1", last_used_at: "2026-11-03T01:50:00.000Z", expired: false })
  assert.equal(usage.last_used_at?.toISOString(), "2026-11-03T01:50:00.000Z")
  assert.equal(usage.expired, false)
  assert.deepEqual(readAgentUsage({ _id: "agent_2", last_used_at: null }), { last_used_at: null, expired: false })
  assert.deepEqual(readAgentUsage({ last_used_at: "not a date", expired: "yes" }), { last_used_at: null, expired: false })
  assert.deepEqual(readAgentUsage(null), { last_used_at: null, expired: false })
  assert.equal(readAgentUsage({ expired: true }).expired, true)
})

test("agentAccess: revoked wins, then expired, else active", () => {
  assert.equal(agentAccess({ revoked: true }, { last_used_at: null, expired: true }), "revoked")
  assert.equal(agentAccess({ revoked: false }, { last_used_at: null, expired: true }), "expired")
  assert.equal(agentAccess({ revoked: false }, { last_used_at: null, expired: false }), "active")
  assert.equal(agentAccess({ revoked: false }), "active")
})

test("withKeyUsage overlays live last use and expiry onto saved API keys by owner and name", () => {
  const used = new Date("2026-11-03T01:50:00.000Z")
  const keys = [
    { name: "BacklogFulfill", owner_id: "user_dylan", last_used_at: null, token_prefix: "x" },
    { name: "Old script", owner_id: "user_dylan", last_used_at: null, token_prefix: "y" },
    { name: "Unknown", owner_id: "user_dylan", last_used_at: null, token_prefix: "z" },
  ]
  const agents = [
    { name: "BacklogFulfill", owner_id: "user_other", revoked: false, last_used_at: null, expired: false },
    { name: "BacklogFulfill", owner_id: "user_dylan", revoked: true, last_used_at: null, expired: false },
    { name: "BacklogFulfill", owner_id: "user_dylan", revoked: false, last_used_at: used, expired: false },
    { name: "Old script", owner_id: "user_dylan", revoked: false, last_used_at: null, expired: true },
  ]
  const [busy, old, unknown] = withKeyUsage(keys, agents)
  assert.equal(busy.last_used_at, used)
  assert.equal(busy.expired, false)
  assert.equal(busy.token_prefix, "x")
  assert.equal(old.last_used_at, null)
  assert.equal(old.expired, true)
  assert.deepEqual(unknown, { ...keys[2], expired: false })
})
