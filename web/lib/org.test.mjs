import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { INVITE_STATUS, ORG_ERRORS, ORG_HEADERS, ORG_ROLES, ORG_TEXT } from "../../shared/names.ts"
import {
  ORG_CHOICE_KEY,
  contextFetch,
  contextHeaders,
  multiOrgOn,
  orgOnlyHeaders,
  readOrgChoice,
  resolveChoice,
  sameChoice,
  writeOrgChoice,
} from "./org-choice.ts"
import {
  OrgApiError,
  canResend,
  canRevoke,
  clampExpiryDays,
  createOrgApi,
  inviteRowParts,
  inviteUrl,
  leaveBlocked,
  parseMembers,
  parseOrgs,
  plausibleEmail,
  removeBlocked,
  tokenFromLocation,
  validOrgName,
} from "./org-api.ts"
import { orgRoute } from "./org-routes.ts"

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8")

function memoryStore(initial = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    data,
  }
}

const json = (status, body) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

const ORGS = [
  { org_id: "org_aaaaaaaaaaaa", name: "0x90 Problems", role: "admin", default_team_id: "team_general0001", teams: [{ team_id: "team_general0001", name: "General" }, { team_id: "team_design00001", name: "Design" }] },
  { org_id: "org_bbbbbbbbbbbb", name: "Side project", role: "member", default_team_id: "team_side0000001", teams: [{ team_id: "team_side0000001", name: "General" }] },
]

// ---------- the flag ----------

test("the flag is off unless NEXT_PUBLIC_MULTI_ORG says on", () => {
  assert.equal(multiOrgOn(undefined), false)
  assert.equal(multiOrgOn(""), false)
  assert.equal(multiOrgOn("off"), false)
  assert.equal(multiOrgOn("0"), false)
  assert.equal(multiOrgOn("1"), true)
  assert.equal(multiOrgOn("true"), true)
  assert.equal(multiOrgOn(" ON "), true)
})

// ---------- header sending ----------

test("headers name the team, or the org before a team is picked, or nothing", () => {
  assert.deepEqual(contextHeaders({ org: "org_aaaaaaaaaaaa", team: "team_general0001" }), { [ORG_HEADERS.TEAM]: "team_general0001" })
  assert.deepEqual(contextHeaders({ org: "org_aaaaaaaaaaaa", team: "" }), { [ORG_HEADERS.ORG]: "org_aaaaaaaaaaaa" })
  assert.deepEqual(contextHeaders(null), {})
  assert.deepEqual(orgOnlyHeaders("org_aaaaaaaaaaaa"), { [ORG_HEADERS.ORG]: "org_aaaaaaaaaaaa" })
})

test("contextFetch sends x-nutshell-team, and drops a team you've left for the org", async () => {
  const calls = []
  const fetcher = async (url, init) => {
    calls.push(init.headers)
    return calls.length === 1 ? json(403, { error: { code: "not_on_team" } }) : json(200, { ok: true })
  }
  let stale = null
  const response = await contextFetch(fetcher, "/api/fs/workspace", { headers: { accept: "application/json" } }, { org: "org_aaaaaaaaaaaa", team: "team_design00001" }, (next) => (stale = next))
  assert.equal(response.status, 200)
  assert.equal(calls[0][ORG_HEADERS.TEAM], "team_design00001")
  assert.equal(calls[1][ORG_HEADERS.TEAM], undefined)
  assert.equal(calls[1][ORG_HEADERS.ORG], "org_aaaaaaaaaaaa")
  assert.deepEqual(stale, { org: "org_aaaaaaaaaaaa", team: "" })
})

test("contextFetch with no choice sends no context headers, and keeps other 403s", async () => {
  const seen = []
  await contextFetch(async (url, init) => (seen.push(init.headers), json(200, {})), "/x", { headers: { a: "1" } }, null, () => assert.fail())
  assert.deepEqual(seen[0], { a: "1" })
  const forbidden = await contextFetch(async () => json(403, { error: { code: "forbidden" } }), "/x", { headers: {} }, { org: "org_aaaaaaaaaaaa", team: "team_general0001" }, () => assert.fail())
  assert.equal(forbidden.status, 403)
})

test("org-management calls send only that org's header; /me and /invites send none", async () => {
  const calls = []
  const api = createOrgApi({
    fetch: async (url, init) => (calls.push({ url, init }), json(200, [])),
    secret: () => "session_secret",
  })
  await api.members("org_aaaaaaaaaaaa")
  await api.myOrgs()
  await api.myInvites()
  assert.equal(calls[0].url, "/api/org/orgs/org_aaaaaaaaaaaa/members")
  assert.equal(calls[0].init.headers[ORG_HEADERS.ORG], "org_aaaaaaaaaaaa")
  assert.equal(calls[0].init.headers[ORG_HEADERS.TEAM], undefined)
  assert.equal(calls[0].init.headers.authorization, "Bearer session_secret")
  for (const call of calls.slice(1)) {
    assert.equal(call.init.headers[ORG_HEADERS.ORG], undefined)
    assert.equal(call.init.headers[ORG_HEADERS.TEAM], undefined)
  }
})

test("board calls carry the active team; the proxies forward both headers", () => {
  const teamChoice = read("./team-choice.ts")
  assert.match(teamChoice, /export function boardContextHeaders\(\)[\s\S]*multiOrgOn\(\) \? contextHeaders\(activeOrgChoice\(\)\) : \{\}/)
  for (const file of ["./board-db.ts", "./site-db.ts", "./connect-agent.ts", "../components/projects/projects-store.tsx"]) {
    assert.match(read(file), /boardContextHeaders\(\)/, file)
  }
  const proxy = read("./board-proxy.ts")
  assert.match(proxy, /for \(const name of \[ORG_HEADERS\.TEAM, ORG_HEADERS\.ORG\]\)/)
  assert.match(read("../app/api/board/route.ts"), /copyContextHeaders\(request\.headers, headers\)/)
  assert.match(read("../app/api/site/route.ts"), /copyContextHeaders\(request\.headers, headers\)/)
})

// ---------- switcher state ----------

test("the choice is stored per browser, and a damaged value reads as nothing", () => {
  const store = memoryStore()
  assert.equal(readOrgChoice(store), null)
  writeOrgChoice(store, { org: "org_aaaaaaaaaaaa", team: "team_design00001" })
  assert.deepEqual(readOrgChoice(store), { org: "org_aaaaaaaaaaaa", team: "team_design00001" })
  writeOrgChoice(store, null)
  assert.equal(store.data.has(ORG_CHOICE_KEY), false)
  assert.equal(readOrgChoice(memoryStore({ [ORG_CHOICE_KEY]: "{not json" })), null)
  assert.deepEqual(readOrgChoice(memoryStore({ [ORG_CHOICE_KEY]: JSON.stringify({ org: "org_aaaaaaaaaaaa", team: "<script>" }) })), { org: "org_aaaaaaaaaaaa", team: "" })
  const throwing = { getItem: () => { throw new Error("blocked") }, setItem: () => { throw new Error("blocked") }, removeItem: () => {} }
  assert.equal(readOrgChoice(throwing), null)
  writeOrgChoice(throwing, { org: "org_aaaaaaaaaaaa", team: "" }) // doesn't throw
})

test("resolveChoice keeps a valid choice, and repairs one for an org or team you've left", () => {
  assert.deepEqual(resolveChoice(ORGS, { org: "org_bbbbbbbbbbbb", team: "team_side0000001" }), { org: "org_bbbbbbbbbbbb", team: "team_side0000001" })
  // A team from the other org is never kept: the org's default instead.
  assert.deepEqual(resolveChoice(ORGS, { org: "org_aaaaaaaaaaaa", team: "team_side0000001" }), { org: "org_aaaaaaaaaaaa", team: "team_general0001" })
  // An org you've left: the server's default (hint), else the first.
  assert.deepEqual(resolveChoice(ORGS, { org: "org_gonegonegone", team: "x" }, { org: "org_bbbbbbbbbbbb", team: "" }), { org: "org_bbbbbbbbbbbb", team: "team_side0000001" })
  assert.deepEqual(resolveChoice(ORGS, null), { org: "org_aaaaaaaaaaaa", team: "team_general0001" })
  assert.deepEqual(resolveChoice(ORGS, null, { org: "org_aaaaaaaaaaaa", team: "team_design00001" }), { org: "org_aaaaaaaaaaaa", team: "team_design00001" })
  // A hint naming a team by name (flag off on the board) is ignored.
  assert.deepEqual(resolveChoice(ORGS, null, { org: "org_aaaaaaaaaaaa", team: "Design" }), { org: "org_aaaaaaaaaaaa", team: "team_general0001" })
  assert.equal(resolveChoice([], { org: "org_aaaaaaaaaaaa", team: "" }), null)
  assert.equal(sameChoice({ org: "a", team: "b" }, { org: "a", team: "b" }), true)
  assert.equal(sameChoice(null, { org: "a", team: "" }), false)
})

test("the switcher lists only the active org's teams, then Create organization", () => {
  const switcher = read("../components/org/org-switcher.tsx")
  assert.match(switcher, /org\.teams\.map/)
  assert.doesNotMatch(switcher, /orgs\.flatMap|row\.teams\.map/)
  assert.ok(switcher.indexOf("ORG_TEXT.ORGS_HEADING") < switcher.indexOf("ORG_TEXT.TEAMS_HEADING"))
  assert.ok(switcher.indexOf("ORG_TEXT.TEAMS_HEADING") < switcher.indexOf("{ORG_TEXT.CREATE}"))
})

test("/me/orgs rows are parsed to the contract and junk dropped", () => {
  const parsed = parseOrgs([...ORGS, { name: "no id" }, null, "x"])
  assert.equal(parsed.length, 2)
  assert.deepEqual(parsed[1].teams, [{ team_id: "team_side0000001", name: "General" }])
  assert.equal(parseOrgs({}).length, 0)
})

// ---------- invites ----------

test("the invite email field has autocomplete off and nothing suggests addresses", () => {
  const view = read("../components/org/org-admin-view.tsx")
  const field = view.slice(view.indexOf('id="invite-email"'), view.indexOf("/>", view.indexOf('id="invite-email"')))
  assert.match(field, /type="email"/)
  assert.match(field, /autoComplete="off"/)
  assert.doesNotMatch(field, /list=|autoComplete="(email|on)"/)
  assert.match(view, /<form onSubmit=\{send\} autoComplete="off"/)
  for (const file of ["../components/org/org-admin-view.tsx", "../components/org/verify-email.tsx", "../components/org/create-org.tsx"]) {
    const source = read(file)
    assert.doesNotMatch(source, /<datalist|SearchCombobox|listBoardUsers|loadSite|autoComplete="(email|on|username)"/, file)
  }
})

test("members never show emails, even if a row carries one", () => {
  const [member] = parseMembers([{ user_id: "u1", username: "naz", name: "Naz", role: "admin", teams: ["team_general0001"], email: "x@example.com" }])
  assert.equal("email" in member, false)
  assert.equal(member.role, ORG_ROLES.ADMIN)
})

test("pending rows read username — email — status; actions follow the status", () => {
  const text = { notJoined: ORG_TEXT.NOT_JOINED, states: ORG_TEXT.INVITE_STATES }
  assert.deepEqual(inviteRowParts({ username: null, email: "a@example.com", status: INVITE_STATUS.PENDING }, text), [ORG_TEXT.NOT_JOINED, "a@example.com", ORG_TEXT.INVITE_STATES.pending])
  assert.deepEqual(inviteRowParts({ username: "ana", email: "a@example.com", status: INVITE_STATUS.ACCEPTED }, text), ["ana", "a@example.com", ORG_TEXT.INVITE_STATES.accepted])
  assert.equal(canRevoke({ status: "pending" }), true)
  assert.equal(canRevoke({ status: "accepted" }), false)
  assert.equal(canResend({ status: "expired" }), false) // the board answers 409
  assert.equal(canResend({ status: "revoked" }), false)
})

test("revoke, remove and leave use the destructive variant; Send invite, Join and Create are the red ones", () => {
  const admin = read("../components/org/org-admin-view.tsx")
  assert.match(admin, /variant="destructive"[^>]*onClick=\{\(\) => void revoke/)
  assert.match(admin, /variant="destructive"[\s\S]{0,400}setRemoving\(member\)/)
  assert.match(admin, /<Button type="submit" disabled=\{!plausibleEmail\(email\) \|\| busy\}>/)
  assert.match(read("../components/org/leave-org.tsx"), /variant="destructive"/)
  assert.match(read("../components/org/accept-invite.tsx"), /<Button onClick=\{\(\) => void join\(step\.preview\)\}/)
})

test("invite links: the token travels in the fragment, and only nsi_ tokens are read", () => {
  const token = "nsi_" + "A".repeat(43)
  assert.equal(tokenFromLocation(`#${token}`, ""), token)
  assert.equal(tokenFromLocation(`#token=${token}`, ""), token)
  assert.equal(tokenFromLocation("", `?token=${token}`), token)
  assert.equal(tokenFromLocation("#clw_abc", "?token=bad"), "")
  assert.equal(inviteUrl(token, "https://app.example/"), `https://app.example/invite#${token}`)
  assert.equal(inviteUrl("https://app.example/invite#x", "https://other"), "https://app.example/invite#x")
})

test("input checks: names 1-60, expiry 1-14 days, plausible emails", () => {
  assert.equal(validOrgName(" "), false)
  assert.equal(validOrgName("A".repeat(61)), false)
  assert.equal(validOrgName("Acme"), true)
  assert.equal(clampExpiryDays(14), 14)
  assert.equal(clampExpiryDays(30), 7)
  assert.equal(clampExpiryDays(0), 7)
  assert.equal(plausibleEmail("a@example.com"), true)
  assert.equal(plausibleEmail("nope"), false)
})

test("invite sends clamp expiry and pass the board's link back; errors keep their code", async () => {
  const bodies = []
  const api = createOrgApi({
    fetch: async (url, init) => {
      bodies.push(JSON.parse(init.body))
      return bodies.length === 1 ? json(202, { invite_id: "inv_aaaaaaaaaaaa", link: "nsi_x" }) : json(429, { error: { code: ORG_ERRORS.RATE_LIMITED, message: "slow down" } })
    },
    secret: () => "s",
  })
  assert.deepEqual(await api.invite("org_aaaaaaaaaaaa", { email: " a@example.com ", role: "member", expires_days: 99 }), { invite_id: "inv_aaaaaaaaaaaa", link: "nsi_x" })
  assert.deepEqual(bodies[0], { email: "a@example.com", role: "member", expires_days: 7 })
  await assert.rejects(api.createOrg("Acme"), (error) => error instanceof OrgApiError && error.code === ORG_ERRORS.RATE_LIMITED && error.status === 429)
})

test("signed out, the API refuses before calling anything", async () => {
  const api = createOrgApi({ fetch: async () => assert.fail("no call"), secret: () => null })
  await assert.rejects(api.myOrgs(), (error) => error.status === 401)
})

test("a 204 from leave or revoke is fine", async () => {
  const api = createOrgApi({ fetch: async () => new Response(null, { status: 204 }), secret: () => "s" })
  await api.leave("org_aaaaaaaaaaaa")
  await api.revokeInvite("org_aaaaaaaaaaaa", "inv_aaaaaaaaaaaa")
})

test("team managers can invite members only, and only admins see the list and links", () => {
  const view = read("../components/org/org-admin-view.tsx")
  assert.match(view, /\(admin \? \[ORG_ROLES\.MEMBER, ORG_ROLES\.ADMIN\] : \[ORG_ROLES\.MEMBER\]\)/)
  assert.match(view, /if \(!admin\) return \/\/ the list, links, Resend and Revoke are for admins/)
  assert.match(view, /admin \|\| manager \? <OrgInvites/)
  assert.match(view, /error\.code === ORG_ERRORS\.NOT_CONFIGURED\) return ORG_TEXT\.NOT_CONFIGURED/)
})

test("link mode only: onboarding never asks for an email, and not_configured is explained", () => {
  assert.doesNotMatch(read("../components/org/org-onboarding.tsx"), /VerifyEmail/)
  assert.match(read("../components/org/verify-email.tsx"), /ORG_ERRORS\.NOT_CONFIGURED\) setOff\(true\)/)
  // The verify step only appears when the board says email mode (403 email_mismatch).
  assert.match(read("../components/org/accept-invite.tsx"), /error\.code === ORG_ERRORS\.EMAIL_MISMATCH\) \{\s*setStep\(\{ kind: "verify"/)
})

// ---------- leaving ----------

test("the last admin can't leave or be removed; anyone else can", () => {
  const solo = [{ user_id: "me", role: "admin" }, { user_id: "u2", role: "member" }]
  const two = [{ user_id: "me", role: "admin" }, { user_id: "u2", role: "admin" }]
  assert.equal(leaveBlocked("admin", "me", solo), true)
  assert.equal(leaveBlocked("admin", "me", two), false)
  assert.equal(leaveBlocked("admin", "me", null), true) // not loaded yet: wait
  assert.equal(leaveBlocked("member", "u2", solo), false)
  assert.equal(removeBlocked(solo[0], solo), true)
  assert.equal(removeBlocked(two[0], two), false)
  assert.equal(removeBlocked(solo[1], solo), false)
})

test("the board's 409 last_admin shows the same clear message", async () => {
  const api = createOrgApi({ fetch: async () => json(409, { error: { code: ORG_ERRORS.LAST_ADMIN, message: "x" } }), secret: () => "s" })
  await assert.rejects(api.leave("org_aaaaaaaaaaaa"), (error) => error.code === ORG_ERRORS.LAST_ADMIN && error.status === 409)
  const card = read("../components/org/leave-org.tsx")
  assert.match(card, /error\.code === ORG_ERRORS\.LAST_ADMIN\) setBlockedByBoard\(true\)/)
  assert.match(card, /\{ORG_TEXT\.LAST_ADMIN\}/)
  assert.match(card, /disabled=\{blocked \|\| busy\}/)
})

// ---------- the proxy ----------

test("only the contract's org routes are proxied, with their methods and query names", () => {
  assert.equal(orgRoute("GET", "me/orgs"), "/me/orgs")
  assert.equal(orgRoute("POST", "me/orgs"), null)
  assert.equal(orgRoute("POST", "orgs"), "/orgs")
  assert.equal(orgRoute("DELETE", "orgs/org_aaaaaaaaaaaa/members/user_dylan"), "/orgs/org_aaaaaaaaaaaa/members/user_dylan")
  assert.equal(orgRoute("POST", "orgs/org_aaaaaaaaaaaa/invites/inv_aaaaaaaaaaaa/revoke"), "/orgs/org_aaaaaaaaaaaa/invites/inv_aaaaaaaaaaaa/revoke")
  assert.equal(orgRoute("GET", "invites/preview", "?token=nsi_abc&extra=1"), "/invites/preview?token=nsi_abc")
  assert.equal(orgRoute("GET", "me/membership", "?team=team_x&evil=1"), "/me/membership?team=team_x")
  assert.equal(orgRoute("GET", "orgs/../users"), null)
  assert.equal(orgRoute("GET", "users"), null)
  assert.equal(orgRoute("GET", "orgs/notanorg/members"), null)
  assert.match(read("../app/api/org/[...path]/route.ts"), /multiOrgOn\(\) \? orgRoute/)
})

// ---------- flag off: today's UI ----------

test("with the flag off every new piece steps aside", () => {
  assert.match(read("../components/org/org-onboarding.tsx"), /return multiOrgOn\(\) \? <Gate>\{children\}<\/Gate> : children/)
  assert.match(read("../components/app-header.tsx"), /\{multiOrgOn\(\) \? <OrgSwitcher \/> : null\}/)
  assert.match(read("../app/organization/page.tsx"), /multiOrgOn\(\) \? <OrgAdminView \/> : <OrganizationView \/>/)
  assert.match(read("../components/profile/my-profile.tsx"), /multiOrgOn\(\) \? <LeaveOrgCard \/> : null/)
  assert.match(read("../app/invite/page.tsx"), /if \(!multiOrgOn\(\)\) notFound\(\)/)
  assert.match(read("../components/team-switcher.tsx"), /multiOrgOn\(\) \? <OrgTeamSwitcher[^:]+: <NamedTeamSwitcher/)
  assert.match(read("../components/auth/auth-gate.tsx"), /multiOrgOn\(\) \? \["\/login", "\/signup", "\/invite"\] : \["\/login", "\/signup"\]/)
  assert.match(read("./pending-invite.ts"), /multiOrgOn\(\) && heldInvite\(\) \? "\/invite" : "\/"/)
  const teamChoice = read("./team-choice.ts")
  assert.match(teamChoice, /if \(multiOrgOn\(\)\) return contextFetch/)
  assert.match(teamChoice, /const KEY = "nutshell\.active-team"/)
  // Off by default: no committed env turns it on.
  assert.equal(multiOrgOn(process.env.NEXT_PUBLIC_MULTI_ORG), multiOrgOn(process.env.NEXT_PUBLIC_MULTI_ORG ?? ""))
})

test("org codes in names.ts and names.json match", () => {
  const json = JSON.parse(read("../../shared/names.json"))
  assert.deepEqual(json.org_headers, { team: ORG_HEADERS.TEAM, org: ORG_HEADERS.ORG })
  assert.deepEqual(json.org_errors.sort(), Object.values(ORG_ERRORS).sort())
  assert.deepEqual(json.invite_status.sort(), Object.values(INVITE_STATUS).sort())
})
