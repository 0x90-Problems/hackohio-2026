import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { register } from "node:module"
import test from "node:test"
import { SCOPES } from "../../shared/names.ts"
import {
  LAST_STEP,
  NAME_STEP,
  SCOPES_STEP,
  SUMMARY_STEP,
  TOKEN_STEP,
  USE_STEP,
  WIZARD_STEPS,
  canAdvance,
  canGoBack,
  closeNeedsConfirm,
  expiresAt,
  initialWizard,
  wizardReducer,
} from "./connect-wizard.ts"
import { curlExample, restTestCall } from "./rest-api.ts"
import { mcpTestCall } from "./mcp-install.ts"

// tokens.ts imports "@/shared/names" like the app does; map the alias for node.
const webRoot = new URL("../", import.meta.url).href
const sharedRoot = new URL("../../shared/", import.meta.url).href
register(
  "data:text/javascript," +
    encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/shared/")) return next(${JSON.stringify(sharedRoot)} + specifier.slice(9) + ".ts", context)
  if (specifier.startsWith("@/")) return next(${JSON.stringify(webRoot)} + specifier.slice(2) + ".ts", context)
  return next(specifier, context)
}`),
)
const { SCOPE_OPTIONS, SCOPE_PRESETS, matchingPreset, orderScopes, scopeGroups, scopeLabel } = await import("./tokens.ts")

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8")
const preset = (id) => SCOPE_PRESETS.find((p) => p.id === id).scopes
const run = (state, ...actions) => actions.reduce((s, a) => wizardReducer(s, a), state)
const PEOPLE_ONLY = [SCOPES.FOLDERS_SHARE, SCOPES.CHAT_MANAGE, SCOPES.CHAT_DM]

test("Read only picks every read scope and nothing that changes anything", () => {
  assert.deepEqual(preset("read"), [
    SCOPES.TICKETS_READ,
    SCOPES.FOLDERS_READ,
    SCOPES.FILES_READ,
    SCOPES.WHITEBOARD_READ,
    SCOPES.CHAT_READ,
  ])
})

test("Tickets picks read, write and comment", () => {
  assert.deepEqual(preset("tickets"), [SCOPES.TICKETS_READ, SCOPES.TICKETS_WRITE, SCOPES.COMMENTS_WRITE])
})

test("Everything picks every offered scope except whiteboard pictures", () => {
  const offered = SCOPE_OPTIONS.map((o) => o.scope)
  assert.deepEqual(preset("everything"), offered.filter((s) => s !== SCOPES.WHITEBOARD_VIEW))
  for (const id of ["read", "tickets", "everything"]) {
    assert.ok(!preset(id).includes(SCOPES.WHITEBOARD_VIEW), `${id} must not tick whiteboard:view`)
    for (const scope of PEOPLE_ONLY) assert.ok(!preset(id).includes(scope), `${id} offers ${scope}`)
  }
})

test("a selection matches its preset in any order, and anything else is custom", () => {
  assert.equal(matchingPreset([SCOPES.COMMENTS_WRITE, SCOPES.TICKETS_READ, SCOPES.TICKETS_WRITE]), "tickets")
  assert.equal(matchingPreset(preset("everything")), "everything")
  assert.equal(matchingPreset([SCOPES.TICKETS_READ]), null)
  assert.equal(matchingPreset([...preset("everything"), SCOPES.WHITEBOARD_VIEW]), null)
  assert.deepEqual(orderScopes([SCOPES.CHAT_READ, SCOPES.TICKETS_READ]), [SCOPES.TICKETS_READ, SCOPES.CHAT_READ])
})

test("choosing a preset in the wizard sets exactly its scopes", () => {
  const start = initialWizard([SCOPES.WHITEBOARD_VIEW])
  const state = run(start, { type: "setScopes", scopes: preset("read") })
  assert.deepEqual(state.scopes, preset("read"))
  assert.equal(matchingPreset(state.scopes), "read")
})

test("scopes are grouped by area and every option is listed once", () => {
  const groups = scopeGroups()
  assert.deepEqual(groups.map((g) => g.label), ["Tickets", "Folders and files", "Whiteboards", "Chat"])
  const listed = groups.flatMap((g) => g.options.map((o) => o.scope))
  assert.deepEqual(listed.toSorted(), SCOPE_OPTIONS.map((o) => o.scope).toSorted())
})

// NSB-66 bug: the whiteboard:view hint read as if it belonged to whiteboard:write.
test("the whiteboard pictures hint belongs to whiteboard:view, not whiteboard:write", () => {
  const boards = scopeGroups().find((g) => g.id === "whiteboards").options
  const write = boards.find((o) => o.scope === SCOPES.WHITEBOARD_WRITE)
  const view = boards.find((o) => o.scope === SCOPES.WHITEBOARD_VIEW)
  assert.equal(write.hint, undefined)
  assert.match(view.hint, /Off by default/)
  assert.ok(boards.indexOf(write) < boards.indexOf(view))

  // In the picker each row holds checkbox, then label, then that row's own hint.
  const source = read("../components/connect/token-wizard.tsx")
  const row = source.slice(source.indexOf("data-scope={scope}"))
  const at = (needle) => {
    const i = row.indexOf(needle)
    assert.ok(i >= 0, needle)
    return i
  }
  assert.match(source, /const hintId = `\$\{id\}-hint`/)
  assert.ok(at("<Checkbox") < at("<Label htmlFor={id}"))
  assert.ok(at("<Label htmlFor={id}") < at("<p id={hintId}"))
  assert.ok(at("<p id={hintId}") < at("</fieldset>"), "the hint renders inside its own row")
  assert.match(row, /aria-describedby=\{hint \? hintId : undefined\}/)
  assert.match(row, /className="flex items-start gap-2\.5"/, "the checkbox lines up with its label, not the hint")
})

test("steps: Next needs a scope, the name step waits for the token, Back stops at the token", () => {
  let state = initialWizard([])
  assert.equal(canAdvance(state), false)
  state = run(state, { type: "next" })
  assert.equal(state.step, SCOPES_STEP)
  state = run(state, { type: "toggleScope", scope: SCOPES.TICKETS_READ, on: true }, { type: "next" })
  assert.equal(state.step, NAME_STEP)
  assert.equal(canAdvance(state), false, "needs a name")
  state = run(state, { type: "setName", name: "  Report bot " })
  assert.equal(canAdvance(state), true)
  assert.equal(run(state, { type: "next" }).step, NAME_STEP, "only a token moves past the name")
  assert.equal(run(state, { type: "back" }).step, SCOPES_STEP)

  state = run(state, { type: "issued", secret: "secret-value", issuedAt: 0, extra: { json: "secret-value" } })
  assert.equal(state.step, TOKEN_STEP)
  assert.equal(canGoBack(state), false, "no way back to edit once the token exists")
  state = run(state, { type: "toggleScope", scope: SCOPES.CHAT_WRITE, on: true }, { type: "setName", name: "x" })
  assert.deepEqual(state.scopes, [SCOPES.TICKETS_READ], "issued tokens are locked")
  state = run(state, { type: "next" })
  assert.equal(state.step, USE_STEP)
  state = run(state, { type: "next" })
  assert.equal(state.step, SUMMARY_STEP)
  assert.equal(SUMMARY_STEP, LAST_STEP, "the summary is the last step")
  assert.equal(WIZARD_STEPS, 5)
  assert.equal(canAdvance(state), false, "nothing after the summary")
  assert.equal(run(state, { type: "next" }).step, SUMMARY_STEP)
  state = run(state, { type: "back" }, { type: "back" })
  assert.equal(state.step, TOKEN_STEP)
  assert.equal(canGoBack(state), false, "back stops at the token")
  assert.equal(state.issued.secret, "secret-value", "back within the page still shows it")
})

test("closing clears the token and everything built from it", () => {
  const defaults = [SCOPES.TICKETS_READ]
  let state = run(
    initialWizard(defaults),
    { type: "setName", name: "Bot" },
    { type: "issued", secret: "secret-value", issuedAt: 1, extra: { json: "has secret-value" } },
    { type: "copied" },
    { type: "reset", scopes: defaults },
  )
  assert.equal(state.issued, null)
  assert.equal(state.step, SCOPES_STEP)
  assert.equal(state.name, "")
  assert.equal(state.copied, false)
  assert.doesNotMatch(JSON.stringify(state), /secret-value/)

  // The page drops it on every way out ("Back to …" and Done both go through close()).
  const source = read("../components/connect/token-wizard.tsx")
  const close = /function close\(\) \{([\s\S]*?)\n  \}/.exec(source)
  assert.ok(close, "token-wizard.tsx has close()")
  assert.match(close[1], /dispatch\(\{ type: "reset"/)
  assert.match(close[1], /router\.push\(returnTo\)/)
  // Reloading or closing the tab with an uncopied secret on screen warns first.
  assert.match(source, /addEventListener\("beforeunload"/)
  // It is a page now, not a narrow modal.
  assert.doesNotMatch(source, /@\/components\/ui\/dialog/)
})

test("closing with an uncopied token asks first; once copied it closes", () => {
  let state = run(initialWizard([SCOPES.TICKETS_READ]), { type: "askClose" })
  assert.equal(state.confirmingClose, false, "nothing to lose before a token exists")
  state = run(state, { type: "issued", secret: "s", issuedAt: 0, extra: null })
  assert.equal(closeNeedsConfirm(state), true)
  state = run(state, { type: "askClose" })
  assert.equal(state.confirmingClose, true)
  state = run(state, { type: "keepOpen" })
  assert.equal(state.confirmingClose, false)
  assert.equal(state.issued.secret, "s")
  state = run(state, { type: "copied" })
  assert.equal(closeNeedsConfirm(state), false)
})

test("expiry is the issue time plus the organization's hours", () => {
  assert.equal(expiresAt(Date.UTC(2026, 0, 1), 24).toISOString(), "2026-01-02T00:00:00.000Z")
  assert.equal(expiresAt(1000, Number.NaN).getTime(), 1000)
})

test("test calls read the secret from an env var, never inline", () => {
  const rest = restTestCall("https://api.example.test")
  assert.match(rest, /^curl -s -o \/dev\/null -w "%\{http_code\}\\n" https:\/\/api\.example\.test\/tickets /)
  assert.ok(!rest.includes("\n"), "one line")
  assert.match(rest, /\$NUTSHELL_API_KEY/)
  assert.match(curlExample("https://api.example.test"), /\$NUTSHELL_API_KEY/)
  const mcp = mcpTestCall("https://mcp.example.test/mcp")
  assert.match(mcp, /^curl -s https:\/\/mcp\.example\.test\/mcp /)
  assert.match(mcp, /"method":"tools\/list"/)
  assert.match(mcp, /\$NUTSHELL_MCP_TOKEN/)
  assert.match(mcp, /Accept: application\/json, text\/event-stream/)
})

test("the API key wizard has no MCP content and both wizards share one component", () => {
  const key = read("../components/api/create-key-wizard.tsx")
  const agent = read("../components/agents/connect-agent-wizard.tsx")
  for (const source of [key, agent]) {
    assert.match(source, /<TokenWizard</)
    assert.match(source, /renderSummary=/, "both end on a summary")
  }
  assert.doesNotMatch(key, /mcp-install|McpInstallActions|MCP gateway|mcpTestCall/)
  assert.match(key, /\["What it may do", "Name and expiry", "Key", "Use it", "Summary"\]/)
  assert.match(agent, /\["What it may do", "Name", "Token", "Install", "Summary"\]/)
  assert.match(agent, /McpInstallActions/)
  // The old inline forms are gone.
  assert.doesNotMatch(read("../components/agents/agents-view.tsx"), /function ConnectAgentCard/)
  assert.doesNotMatch(read("../components/api/api-view.tsx"), /function CreateKeyDialog/)
})

test("the entry points open the pages and come back where they started", () => {
  const agents = read("../components/agents/agents-view.tsx")
  const api = read("../components/api/api-view.tsx")
  assert.match(agents, /withReturn\("\/agents\/connect", "\/agents"\)/)
  assert.match(api, /withReturn\("\/api\/keys\/new", "\/api"\)/)
  assert.match(read("../app/agents/connect/page.tsx"), /safeReturnPath\(typeof from === "string" \? from : null, "\/agents"\)/)
  assert.match(read("../app/api/keys/new/page.tsx"), /safeReturnPath\(typeof from === "string" \? from : null, "\/api"\)/)
})

test("scope labels read as plain words, and unknown scopes show as themselves", () => {
  assert.equal(scopeLabel(SCOPES.TICKETS_READ), "Read tickets")
  assert.equal(scopeLabel("made:up"), "made:up")
})
