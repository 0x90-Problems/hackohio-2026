import assert from "node:assert/strict"
import test from "node:test"
import { WARN_MS, expiryOf, refusedReason, sessionPhase, signedOutMessage } from "./session-expiry.ts"

test("the expiry comes from the sign-in response's token", () => {
  assert.equal(expiryOf({ secret: "x", token: { expires_at: "2026-01-01T10:00:00.000Z" } }), Date.parse("2026-01-01T10:00:00.000Z"))
  assert.equal(expiryOf({ secret: "x" }), null)
  assert.equal(expiryOf({ token: { expires_at: "soon" } }), null)
  assert.equal(expiryOf(null), null)
})

test("a session is ok, then ending soon, then expired", () => {
  const end = 1_000_000_000
  assert.equal(sessionPhase(end, end - WARN_MS - 1), "ok")
  assert.equal(sessionPhase(end, end - WARN_MS), "soon")
  assert.equal(sessionPhase(end, end - 1), "soon")
  assert.equal(sessionPhase(end, end), "expired")
  assert.equal(sessionPhase(null, end), "unknown")
})

test("only the board's 401 about the token ends the session", () => {
  assert.equal(refusedReason(401, "token_expired"), "expired")
  assert.equal(refusedReason(401, "token_revoked"), "revoked")
  assert.equal(refusedReason(401, "unauthorized"), "revoked")
  assert.equal(refusedReason(401, undefined), null)
  assert.equal(refusedReason(403, "token_expired"), null)
  assert.equal(refusedReason(503, "board_unavailable"), null)
})

test("each reason has its own line on the sign-in page", () => {
  assert.match(signedOutMessage("expired"), /session expired/)
  assert.match(signedOutMessage("revoked"), /signed out/)
  assert.match(signedOutMessage("renew"), /Sign in again/)
})
