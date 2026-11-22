import assert from "node:assert/strict"
import test from "node:test"
import { keepPresent, suggestionHref, suggestionLinkLabel, toggleAll, toggleId } from "./suggestion-links.ts"

test("each kind of target opens the right page", () => {
  assert.equal(suggestionHref({ kind: "ticket", ref: "NSB-12" }), "/projects/NSB/board/ticket/NSB-12")
  assert.equal(suggestionHref({ kind: "file", ref: "nte_01abc" }), "/docs/nte_01abc")
  assert.equal(suggestionHref({ kind: "file", ref: "wbd_01abc" }), "/boards/wbd_01abc")
  assert.equal(suggestionHref({ kind: "file", ref: "fld_01abc" }), "/files?folder=fld_01abc")
  assert.equal(suggestionHref({ kind: "file", ref: "fil_01abc" }), "/api/files/fil_01abc/view")
  assert.equal(suggestionHref({ kind: "page", ref: "/projects/NSB/board" }), "/projects/NSB/board")
  assert.equal(suggestionHref(undefined), null)
})

test("anything that isn't an in-app page never becomes a link", () => {
  for (const ref of ["https://evil.example", "//evil.example", "/\\evil", "javascript:alert(1)", "/a\nb"]) {
    assert.equal(suggestionHref({ kind: "page", ref }), null, ref)
  }
  assert.equal(suggestionHref({ kind: "ticket", ref: "nsb-1" }), null)
  assert.equal(suggestionHref({ kind: "file", ref: "../etc" }), null)
})

test("the open button says what it opens", () => {
  assert.equal(suggestionLinkLabel({ kind: "ticket", ref: "NSB-3" }), "Open NSB-3")
  assert.equal(suggestionLinkLabel({ kind: "file", ref: "nte_1" }), "Open the note")
  assert.equal(suggestionLinkLabel({ kind: "page", ref: "/x" }), "Open the page")
})

test("selecting rows one at a time and all at once", () => {
  assert.deepEqual([...toggleId(new Set(), "a")], ["a"])
  assert.deepEqual([...toggleId(new Set(["a"]), "a")], [])
  assert.deepEqual([...toggleAll(new Set(["a"]), ["a", "b"])].sort(), ["a", "b"])
  assert.deepEqual([...toggleAll(new Set(["a", "b"]), ["a", "b"])], [])
  assert.deepEqual([...toggleAll(new Set(), [])], [])
  assert.deepEqual([...keepPresent(new Set(["a", "gone"]), ["a", "b"])], ["a"])
})
