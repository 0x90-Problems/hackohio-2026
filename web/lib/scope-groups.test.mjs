import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { register } from "node:module"
import test from "node:test"

// scope-groups.ts imports SCOPES from "@/shared/names": point that alias at ../shared for plain node.
const shared = new URL("../../shared/", import.meta.url).href
const hooks = `export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/shared/")) return next(${JSON.stringify(shared)} + specifier.slice(9) + ".ts", context)
  return next(specifier, context)
}`
register(`data:text/javascript,${encodeURIComponent(hooks)}`)

const { ALL_SCOPES, SCOPES } = await import("../../shared/names.ts")
const { groupScopes, scopeArea, scopeCountLabel, scopeSummary, SCOPE_AREAS } = await import("./scope-groups.ts")
const { agentCountLabel } = await import("./agent-label.ts")

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8")

test("every scope belongs to a named area", () => {
  for (const scope of ALL_SCOPES) assert.ok(SCOPE_AREAS.includes(scopeArea(scope)), scope)
})

test("all scopes sum up as a count and their areas", () => {
  const summary = scopeSummary(ALL_SCOPES)
  assert.equal(summary.count, `${ALL_SCOPES.length} scopes`)
  assert.equal(summary.areas, SCOPE_AREAS.join(", "))
})

test("groups keep a fixed area order and drop duplicates", () => {
  const groups = groupScopes([SCOPES.CHAT_READ, SCOPES.TICKETS_WRITE, SCOPES.COMMENTS_WRITE, SCOPES.CHAT_READ])
  assert.deepEqual(groups, [
    { area: "Tickets", scopes: [SCOPES.TICKETS_WRITE, SCOPES.COMMENTS_WRITE] },
    { area: "Chat", scopes: [SCOPES.CHAT_READ] },
  ])
  assert.deepEqual(scopeSummary([SCOPES.CHAT_READ, SCOPES.CHAT_READ]), { count: "1 scope", areas: "Chat" })
})

test("a scope this build doesn't know is still listed", () => {
  assert.deepEqual(groupScopes(["maps:read"]), [{ area: "Other", scopes: ["maps:read"] }])
})

test("counts read naturally", () => {
  assert.equal(scopeCountLabel(0), "No scopes")
  assert.equal(scopeCountLabel(13), "13 scopes")
  assert.equal(agentCountLabel(0), "No agents")
  assert.equal(agentCountLabel(1), "1 agent")
  assert.equal(agentCountLabel(2), "2 agents")
})

// NSB-65: the team card is about the person; agents and scopes live on the profile.
test("team member cards show an agent count, not every scope", () => {
  const teams = read("../components/teams/teams-view.tsx")
  assert.doesNotMatch(teams, /ScopeBadge/)
  assert.match(teams, /agentCountLabel\(/)
  const profile = read("../components/profile/profile-view.tsx")
  assert.match(profile, /ScopeBadge/)
})

test("the Agents table sums up scopes and expands them on click", () => {
  const agents = read("../components/agents/agents-view.tsx")
  const row = agents.slice(agents.indexOf("function AgentRow"))
  assert.match(row, /<ScopeSummary scopes=\{agent\.scopes\}/)
  assert.doesNotMatch(row.slice(0, row.indexOf("RevokeDialog")), /agent\.scopes\.map/)
  assert.match(read("../components/scope-summary.tsx"), /PopoverTrigger/)
})
