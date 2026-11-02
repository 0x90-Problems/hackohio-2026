import assert from "node:assert/strict"
import test from "node:test"
import { isSaverIn } from "./docs-saver.ts"

const editor = { can_edit: true }
const viewer = { can_edit: false }
const old = {} // a browser on older code, editing or not: it doesn't say
const room = (entries) => new Map(Object.entries(entries).map(([id, state]) => [Number(id), state]))
// What a browser on older code does: the lowest id of all.
const oldSaves = (me, states) => Math.min(...states.keys()) === me

test("alone, or before any other browser is known, you save", () => {
  assert.equal(isSaverIn(5, true, room({})), true)
  assert.equal(isSaverIn(5, true, room({ 5: editor })), true)
})

test("the lowest id among those who can edit saves", () => {
  const states = room({ 3: editor, 5: editor })
  assert.equal(isSaverIn(3, true, states), true)
  assert.equal(isSaverIn(5, true, states), false)
})

test("a view-only browser with the lowest id doesn't hold up saving", () => {
  const states = room({ 1: viewer, 3: editor, 5: editor })
  assert.equal(isSaverIn(3, true, states), true)
  assert.equal(isSaverIn(5, true, states), false)
})

test("a view-only browser never saves, whatever else is in the room", () => {
  assert.equal(isSaverIn(1, false, room({ 1: viewer })), false)
  assert.equal(isSaverIn(1, false, room({ 1: viewer, 3: editor })), false)
  assert.equal(isSaverIn(1, false, room({})), false)
})

test("your own state doesn't matter, only what you know about yourself", () => {
  assert.equal(isSaverIn(3, true, room({ 3: old, 5: editor })), true)
  assert.equal(isSaverIn(3, true, room({ 3: viewer, 5: editor })), true) // someone forged it
})

test("an older browser with the lowest id saves, and new ones leave it to that browser", () => {
  const states = room({ 1: old, 3: editor, 5: editor })
  assert.equal(oldSaves(1, states), true)
  assert.equal(isSaverIn(3, true, states), false)
  assert.equal(isSaverIn(5, true, states), false)
})

test("a new editor with the lowest id saves, and older browsers leave it to that one", () => {
  const states = room({ 1: editor, 3: old })
  assert.equal(isSaverIn(1, true, states), true)
  assert.equal(oldSaves(3, states), false)
})

test("older browsers waiting behind a new view-only one don't count, so a new editor still saves", () => {
  const states = room({ 1: viewer, 3: old, 5: editor })
  assert.equal(oldSaves(3, states), false)
  assert.equal(isSaverIn(5, true, states), true)
})

test("every mix of old and new has at most one saver, and one whenever it can", () => {
  const kinds = { editor, viewer, old }
  const names = Object.keys(kinds)
  for (const a of names) {
    for (const b of names) {
      for (const c of names) {
        const states = room({ 1: kinds[a], 2: kinds[b], 3: kinds[c] })
        const saves = (id, kind) => (kind === "old" ? oldSaves(id, states) : isSaverIn(id, kind === "editor", states))
        const savers = [saves(1, a), saves(2, b), saves(3, c)].filter(Boolean).length
        assert.ok(savers <= 1, `${a} ${b} ${c}: ${savers} savers`)
        // The only rooms that can't save without a person reloading: the lowest id is an older
        // browser (it may be view-only), or only older browsers could save and they're waiting.
        const canEdit = [a, b, c].includes("editor")
        if (canEdit && a !== "old") assert.equal(savers, 1, `${a} ${b} ${c}`)
      }
    }
  }
})

test("a false claim from a read-only browser pauses saving but gives it nothing", () => {
  const states = room({ 1: { can_edit: true }, 3: editor })
  assert.equal(isSaverIn(3, true, states), false) // paused while it claims this
  assert.equal(isSaverIn(1, false, states), false) // and its own browser still won't save
})
