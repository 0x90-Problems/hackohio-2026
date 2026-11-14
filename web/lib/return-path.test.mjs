import assert from "node:assert/strict"
import test from "node:test"
import { returnLabel, safeReturnPath, withReturn } from "./return-path.ts"

const FALLBACK = "/agents"

test("plain in-app paths are kept", () => {
  for (const path of ["/", "/agents", "/api", "/projects/NSB", "/projects/NSB/board?view=table#top", "/files?folder=fld_1"]) {
    assert.equal(safeReturnPath(path, FALLBACK), path, path)
  }
  assert.equal(safeReturnPath("  /api  ", FALLBACK), "/api", "surrounding spaces are trimmed")
})

test("anything that could leave the app falls back", () => {
  const bad = [
    "//evil.example",
    "//evil.example/agents",
    "/\\evil.example",
    "\\\\evil.example",
    "/agents\\..\\..\\evil",
    "https://evil.example",
    "http://evil.example/agents",
    "javascript:alert(1)",
    "data:text/html,hi",
    "mailto:someone@example.com",
    "evil.example",
    "agents",
    "/\t/evil.example",
    "/\n/evil.example",
    "/agents\u0000",
    "/%2F/evil.example",
    "/%2f/evil.example",
    "/%5C/evil.example",
    "/%5c%5cevil.example",
    "",
    "   ",
    "/" + "a".repeat(600),
  ]
  for (const path of bad) assert.equal(safeReturnPath(path, FALLBACK), FALLBACK, JSON.stringify(path))
})

test("missing or non-string values fall back", () => {
  for (const value of [null, undefined, 42, ["/agents"], { path: "/agents" }]) {
    assert.equal(safeReturnPath(value, FALLBACK), FALLBACK)
  }
})

test("the Back button names the page it returns to", () => {
  assert.equal(returnLabel("/"), "Home")
  assert.equal(returnLabel("/agents"), "Agents")
  assert.equal(returnLabel("/api?tab=keys"), "API")
  assert.equal(returnLabel("/projects/NSB/board"), "Projects")
  assert.equal(returnLabel("/agentsville"), "where you were", "a prefix only matches a whole path segment")
  assert.equal(returnLabel("/chat"), "where you were")
})

test("links to the pages carry an encoded return path", () => {
  assert.equal(withReturn("/agents/connect", "/"), "/agents/connect?from=%2F")
  assert.equal(withReturn("/api/keys/new", "/projects/NSB?x=1&y=2"), "/api/keys/new?from=%2Fprojects%2FNSB%3Fx%3D1%26y%3D2")
  // What the link carries comes back unchanged through the sanitizer.
  const from = new URL(withReturn("/agents/connect", "/projects/NSB?x=1"), "https://app.test").searchParams.get("from")
  assert.equal(safeReturnPath(from, FALLBACK), "/projects/NSB?x=1")
})
