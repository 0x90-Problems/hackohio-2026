import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { ALL_SCOPES, SCOPES } from "../../shared/names.ts"

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8")

test("names.json lists the same scopes as names.ts", () => {
  assert.deepEqual(JSON.parse(read("../../shared/names.json")).scopes, ALL_SCOPES)
})

// NSB-47: pictures of a board are their own scope, offered to owners but never ticked for them.
test("whiteboard pictures are offered with a warning and start unticked", () => {
  assert.equal(SCOPES.WHITEBOARD_VIEW, "whiteboard:view")
  const tokens = read("./tokens.ts")
  const offer = /scope: SCOPES\.WHITEBOARD_VIEW,\s*label: "See whiteboard pictures",[^}]*?hint: "([^"]+)"/.exec(tokens)
  assert.ok(offer, "tokens.ts offers whiteboard:view with a hint")
  assert.match(offer[1], /Off by default/)
  // NSB-66: both wizards start from their own defaults, never with pictures ticked.
  for (const view of ["../components/agents/connect-agent-wizard.tsx", "../components/api/create-key-wizard.tsx"]) {
    const source = read(view)
    const defaults = /defaultScopes=\{\[([^\]]*)\]\}/.exec(source)
    assert.ok(defaults, view)
    assert.doesNotMatch(defaults[1], /WHITEBOARD_VIEW/, view)
  }
  assert.match(read("../components/connect/token-wizard.tsx"), /aria-describedby=\{hint \? hintId/)
})
