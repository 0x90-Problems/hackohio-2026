import assert from "node:assert/strict"
import test from "node:test"
import { FieldError, checkFieldValue, daysUntil, fieldDefsOf, parseFieldDefs } from "./table-fields.ts"

test("template field names become typed fields with stable ids", () => {
  assert.deepEqual(
    fieldDefsOf({ fields: ["Iteration", "Estimate", "Target date"] }).map((field) => `${field.id}:${field.type}`),
    ["f_iteration:text", "f_estimate:number", "f_target_date:date"]
  )
})

test("a new field gets the same id the board will give it", () => {
  const current = fieldDefsOf({ fields: ["Estimate"] })
  const next = parseFieldDefs([...current, { name: "Due by", type: "countdown" }], current)
  assert.equal(next[1].id, "f_due_by")
  assert.throws(() => parseFieldDefs([{ name: "Status", type: "text" }], current), FieldError)
})

test("cell values are checked the way the board checks them", () => {
  const select = { id: "f_p", name: "Priority", type: "select", options: ["High", "Low"] }
  assert.equal(checkFieldValue(select, "low", () => false), "Low")
  assert.throws(() => checkFieldValue({ id: "f_n", name: "N", type: "number" }, "abc", () => false), /must be a number/)
  assert.equal(daysUntil("2026-12-01", "2026-11-25"), 6)
  assert.equal(daysUntil("2026-11-20", "2026-11-25"), -5)
})
