import assert from "node:assert/strict"
import test from "node:test"
import { FEED_PAGE, moreRows, rowsAfterNew } from "./feed-window.ts"

test("more rows come a page at a time, never past the end", () => {
  assert.equal(moreRows(FEED_PAGE, 500), FEED_PAGE * 2)
  assert.equal(moreRows(480, 500), 500)
  assert.equal(moreRows(500, 500), 500)
  assert.equal(moreRows(0, 10), 10)
})

test("new events at the top don't push shown rows out of view", () => {
  assert.equal(rowsAfterNew(60, 200, 203), 63)
  assert.equal(rowsAfterNew(30, 30, 31), 31)
})

test("a short feed shows everything, a fresh one starts at one page", () => {
  assert.equal(rowsAfterNew(0, 0, 12), 12)
  assert.equal(rowsAfterNew(0, 0, 400), FEED_PAGE)
  // A feed that shrinks (another board) keeps what was shown, never more than there is.
  assert.equal(rowsAfterNew(90, 400, 100), 90)
  assert.equal(rowsAfterNew(150, 400, 100), 100)
})
