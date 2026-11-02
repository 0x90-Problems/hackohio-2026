import assert from "node:assert/strict"
import test from "node:test"
import { mergeLines, missingVersions } from "./docs-merge.ts"

const human = (version) => ({ version, created_by: { type: "human" } })
const agent = (version) => ({ version, created_by: { type: "agent" } })

test("nothing is missing when the newest version came from the editor", () => {
  assert.equal(missingVersions([human(1), agent(2), human(3)], 1), null)
})

test("nothing is missing once the newest version is applied", () => {
  assert.equal(missingVersions([human(1), agent(2)], 2), null)
})

test("an agent version is based on the version before it", () => {
  assert.deepEqual(missingVersions([human(1), agent(2)], 1), { base: 1, latest: 2 })
})

test("a run of agent versions is based on the last one the editor had", () => {
  assert.deepEqual(missingVersions([human(1), human(2), agent(3), agent(4)], 0), { base: 2, latest: 4 })
  assert.deepEqual(missingVersions([agent(1), agent(2), agent(3)], 2), { base: 2, latest: 3 })
})

test("a document only ever written by agents is based on its first version", () => {
  assert.deepEqual(missingVersions([agent(1), agent(2), agent(3)], 0), { base: 1, latest: 3 })
  assert.equal(missingVersions([agent(1)], 0), null)
})

test("a restore counts as outside the editor", () => {
  assert.deepEqual(missingVersions([human(1), human(2), { ...human(3), restored_from: 1 }], 2), { base: 2, latest: 3 })
})

test("merge: only one side changed", () => {
  assert.equal(mergeLines("a\nb", "a\nb", "a\nc"), "a\nc")
  assert.equal(mergeLines("a\nb", "a\nc", "a\nb"), "a\nc")
  assert.equal(mergeLines("a\nb", "a\nc", "a\nc"), "a\nc")
})

test("merge: separate parts keep both edits, whichever side is first", () => {
  assert.equal(mergeLines("a\nb\nc", "A\nb\nc", "a\nb\nC"), "A\nb\nC")
  assert.equal(mergeLines("a\nb\nc", "a\nb\nC", "A\nb\nc"), "A\nb\nC")
})

test("merge: added and removed lines keep their places", () => {
  assert.equal(mergeLines("a\nb\nc\nd", "a\nnew\nb\nc\nd", "a\nb\nc"), "a\nnew\nb\nc")
})

test("merge: the same part changed needs a person", () => {
  assert.equal(mergeLines("a\nb\nc", "a\nX\nc", "a\nY\nc"), null)
  assert.equal(mergeLines("a\nb", "a\nb\nX", "a\nb\nY"), null)
})

test("merge: touching edits with no unchanged line between need a person", () => {
  assert.equal(mergeLines("a\nb", "A\nb", "a\nB"), null)
})
