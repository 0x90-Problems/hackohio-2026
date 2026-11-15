import assert from "node:assert/strict"
import test from "node:test"
import { confirmsCommentEcho, mergeServerComments } from "./comment-echo.ts"

const me = { type: "human", id: "user_a", name: "A" }
const comment = (body, at, extra = {}) => ({ ticket_key: "AB-1", author: me, body, created_at: new Date(at), ...extra })
const echo = (body, at) => comment(body, at, { local: true })

test("the board's copy replaces the local echo instead of showing twice", () => {
  const shown = [comment("first", "2026-01-01T10:00:00Z"), echo("hello", "2026-01-01T10:05:00.100Z")]
  const merged = mergeServerComments(shown, [shown[0], comment("hello", "2026-01-01T10:05:03.900Z")])
  assert.equal(merged.length, 2)
  assert.equal(merged[1].local, undefined)
  assert.equal(merged[1].created_at.toISOString(), "2026-01-01T10:05:03.900Z")
})

test("nothing new from the board keeps the same list", () => {
  const shown = [comment("first", "2026-01-01T10:00:00Z"), echo("not saved yet", "2026-01-01T10:05:00Z")]
  assert.equal(mergeServerComments(shown, [shown[0]]), shown)
})

test("the same text posted twice still shows twice", () => {
  const shown = [echo("+1", "2026-01-01T10:00:00Z"), echo("+1", "2026-01-01T10:00:20Z")]
  const merged = mergeServerComments(shown, [comment("+1", "2026-01-01T10:00:01Z"), comment("+1", "2026-01-01T10:00:21Z")])
  assert.equal(merged.length, 2)
  assert.ok(merged.every((item) => !item.local))
})

test("someone else's comment, another ticket or an old one is not an echo", () => {
  const mine = echo("done", "2026-01-01T10:00:00Z")
  assert.equal(confirmsCommentEcho(mine, comment("done", "2026-01-01T10:00:02Z", { author: { ...me, id: "user_b" } })), false)
  assert.equal(confirmsCommentEcho(mine, comment("done", "2026-01-01T10:00:02Z", { ticket_key: "AB-2" })), false)
  assert.equal(confirmsCommentEcho(mine, comment("done", "2026-01-01T10:30:00Z")), false)
  const merged = mergeServerComments([mine], [comment("done", "2026-01-01T10:00:02Z", { author: { ...me, id: "user_b" } })])
  assert.equal(merged.length, 2)
})

test("a comment already confirmed is never used for a later echo", () => {
  const confirmed = comment("ok", "2026-01-01T10:00:01Z")
  const shown = [confirmed, echo("ok", "2026-01-01T10:01:00Z")]
  assert.equal(mergeServerComments(shown, [confirmed]), shown)
})
