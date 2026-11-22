import assert from "node:assert/strict"
import test from "node:test"
import { keepPresent, outsideLink, suggestionHref, suggestionLinkLabel, toggleAll, toggleId } from "./suggestion-links.ts"

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

test("an outside link opens only if it's https with no user name or password, and names its site", () => {
  assert.deepEqual(outsideLink({ kind: "url", ref: "https://www.github.com/0x90-Problems" }), { href: "https://www.github.com/0x90-Problems", host: "github.com" })
  for (const ref of ["http://example.com", "javascript:alert(1)", "https://user:pw@example.com", "https://good.example@evil.example", "nonsense"]) {
    assert.equal(outsideLink({ kind: "url", ref }), null, ref)
  }
  assert.equal(outsideLink({ kind: "page", ref: "/x" }), null)
  // A look-alike domain shows as xn--, not as the letters it imitates.
  assert.match(outsideLink({ kind: "url", ref: "https://gіthub.com" }).host, /^xn--/)
  // An outside link is never treated as an in-app page.
  assert.equal(suggestionHref({ kind: "url", ref: "https://example.com" }), null)
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
