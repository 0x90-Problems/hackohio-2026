import assert from "node:assert/strict"
import test from "node:test"
import { cleanPageName, nextUntitled } from "./page-names.ts"

test("the first new page is Untitled 1", () => {
  assert.equal(nextUntitled([]), "Untitled 1")
  assert.equal(nextUntitled(["Notes", "Plan"]), "Untitled 1")
})

test("numbers go one past the highest, even with gaps", () => {
  assert.equal(nextUntitled(["Untitled 1", "Untitled 2"]), "Untitled 3")
  assert.equal(nextUntitled(["Untitled 1", "Untitled 7"]), "Untitled 8")
})

test("a plain Untitled counts as 1, and old time-stamped names don't count", () => {
  assert.equal(nextUntitled(["Untitled"]), "Untitled 2")
  assert.equal(nextUntitled(["Untitled 10:42 AM"]), "Untitled 1")
})

test("typed names are trimmed onto one line", () => {
  assert.equal(cleanPageName("  Meeting\n notes  "), "Meeting notes")
  assert.equal(cleanPageName("   "), "")
})
