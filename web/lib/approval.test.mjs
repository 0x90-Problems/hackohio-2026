import assert from "node:assert/strict"
import test from "node:test"
import { approvalRole, approvalsWaitingOn, cleanReason } from "./approval.ts"

const agent = { type: "agent", id: "agent_x", acting_for: "user_dylan", name: "Bot" }
const raddy = { type: "human", id: "user_raddy", name: "Raddy" }
const request = (by, minutes = 0) => ({ by, at: new Date(Date.UTC(2026, 10, 14, 12, minutes)), from: "in_progress", to: "done" })

test("nothing waiting means no role", () => {
  assert.equal(approvalRole({}, { id: "user_naz", admin: false }), null)
})

test("anyone but the asker answers when no reviewer is set, including the agent's own person", () => {
  const ticket = { approval_request: request(agent) }
  assert.equal(approvalRole(ticket, { id: "user_dylan", admin: false }), "answer")
  assert.equal(approvalRole({ approval_request: request(raddy) }, { id: "user_raddy", admin: true }), "withdraw")
})

test("with a reviewer, only the reviewer or an org admin answers", () => {
  const ticket = { approval_request: request(agent), reviewer_id: "user_naz" }
  assert.equal(approvalRole(ticket, { id: "user_naz", admin: false }), "answer")
  assert.equal(approvalRole(ticket, { id: "user_raddy", admin: false }), "wait")
  assert.equal(approvalRole(ticket, { id: "user_dylan", admin: true }), "answer")
})

test("waiting on you lists what you can answer, newest first", () => {
  const older = { key: "A-1", approval_request: request(agent, 1) }
  const newer = { key: "A-2", approval_request: request(agent, 5) }
  const mine = { key: "A-3", approval_request: request(raddy, 9) }
  const other = { key: "A-4", approval_request: request(agent, 7), reviewer_id: "user_naz" }
  const none = { key: "A-5" }
  const keys = approvalsWaitingOn([older, newer, mine, other, none], { id: "user_raddy", admin: false }).map((ticket) => ticket.key)
  assert.deepEqual(keys, ["A-2", "A-1"])
})

test("reasons are trimmed and capped", () => {
  assert.equal(cleanReason("  needs tests \n"), "needs tests")
  assert.equal(cleanReason("x".repeat(1200)).length, 1000)
})
