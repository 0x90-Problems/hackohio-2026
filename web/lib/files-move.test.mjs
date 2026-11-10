import assert from "node:assert/strict"
import test from "node:test"
import { dropCheck, moveSummary, rangeIds, settleLimited } from "./files-move.ts"

const order = ["a", "b", "c", "d", "e"]

test("a shift-click picks everything between the anchor and the item, either way", () => {
  assert.deepEqual(rangeIds(order, "b", "d"), ["b", "c", "d"])
  assert.deepEqual(rangeIds(order, "d", "b"), ["b", "c", "d"])
  assert.deepEqual(rangeIds(order, "c", "c"), ["c"])
})

test("with no anchor, or one that's gone from the list, a shift-click picks just the item", () => {
  assert.deepEqual(rangeIds(order, null, "c"), ["c"])
  assert.deepEqual(rangeIds(order, "zz", "c"), ["c"])
})

const folder = (id, parent = "root") => ({ id, type: "folder", parent })
const file = (id, parent = "root") => ({ id, type: "file", parent })

test("a folder can't be dropped into itself", () => {
  const check = dropCheck([folder("f1"), file("x")], { id: "f1", name: "F1", ancestors: ["root"] })
  assert.equal(check.ok, false)
})

test("a folder can't be dropped into anything under it", () => {
  const check = dropCheck([folder("f1")], { id: "deep", name: "Deep", ancestors: ["root", "f1", "mid"] })
  assert.equal(check.ok, false)
  assert.match(check.reason, /inside itself/)
})

test("a file may go into a folder whose id is on its path", () => {
  // Only folders make cycles.
  const check = dropCheck([file("f1")], { id: "deep", name: "Deep", ancestors: ["root", "f1"] })
  assert.equal(check.ok, true)
})

test("items already in the target are left out, and a drop that moves nothing is refused", () => {
  const some = dropCheck([file("x", "docs"), file("y", "root")], { id: "docs", name: "Docs", ancestors: ["root"] })
  assert.deepEqual(some.ok && some.nodes.map((node) => node.id), ["y"])
  const none = dropCheck([file("x", "docs")], { id: "docs", name: "Docs", ancestors: ["root"] })
  assert.deepEqual(none, { ok: false, reason: "Already in Docs." })
})

test("settleLimited keeps the order, never runs more than the limit, and carries on past failures", async () => {
  let running = 0
  let most = 0
  const results = await settleLimited([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
    running += 1
    most = Math.max(most, running)
    await new Promise((resolve) => setTimeout(resolve, 5 * (8 - n)))
    running -= 1
    if (n === 4) throw new Error("four")
    return n * 10
  })
  assert.equal(most, 3)
  assert.deepEqual(
    results.map((result) => (result.ok ? result.value : result.error.message)),
    [10, 20, 30, "four", 50, 60, 70]
  )
})

test("settleLimited with nothing to do", async () => {
  assert.deepEqual(await settleLimited([], 3, async () => 1), [])
})

test("one toast for the whole batch", () => {
  assert.deepEqual(moveSummary(["a.txt"], [], "Docs"), { ok: true, title: "Moved a.txt to Docs" })
  assert.deepEqual(moveSummary(["a", "b", "c", "d", "e"], [], "Docs"), { ok: true, title: "Moved 5 items to Docs" })
  assert.deepEqual(moveSummary(["a", "b", "c", "d", "e"], [{ name: "c", reason: "Someone changed it first." }], "Docs"), {
    ok: false,
    title: "Moved 4 of 5 to Docs",
    description: "1 couldn't move: Someone changed it first.",
  })
})

test("different reasons name the items; nothing moved says so", () => {
  const mixed = moveSummary(["a", "b", "c"], [{ name: "a", reason: "No access." }, { name: "b", reason: "Gone." }], "Docs")
  assert.equal(mixed.title, "Moved 1 of 3 to Docs")
  assert.equal(mixed.description, "2 couldn't move: a: No access.; b: Gone.")
  const none = moveSummary(["a", "b"], [{ name: "a", reason: "No access." }, { name: "b", reason: "No access." }], "Docs")
  assert.deepEqual(none, { ok: false, title: "Couldn't move 2 items", description: "No access." })
})
