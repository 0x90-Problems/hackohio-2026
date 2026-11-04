import assert from "node:assert/strict"
import test from "node:test"
import { FILE_COOKIE, fileViewPath, handleFileSession, handleFileView, readCookie } from "./file-view.ts"

const BUCKET = "nutshell-prod-files-883501587155.s3.amazonaws.com"
const SIGNED = `https://${BUCKET}/clean/ws/x?X-Amz-Expires=60&X-Amz-Signature=abc`
const TOKEN = "secret_token_value_123"

function request(path, { cookie, accept = "text/html" } = {}) {
  const headers = { accept }
  if (cookie) headers.cookie = cookie
  return new Request(`https://app.example${path}`, { headers })
}

function deps(reply, calls = []) {
  return {
    bucketHosts: [BUCKET],
    secure: true,
    fetchLink: async (path, bearer, team) => {
      calls.push({ path, bearer, team })
      return typeof reply === "function" ? reply(calls.length) : reply
    },
  }
}

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

test("signed out: a browser goes to sign in, never to the file, and the files API isn't asked", async () => {
  const calls = []
  const res = await handleFileView(request("/api/files/fil_1/view"), "fil_1", deps(json(200, { url: SIGNED }), calls))
  assert.equal(res.status, 302)
  assert.equal(res.headers.get("location"), "https://app.example/login")
  assert.equal(res.headers.get("cache-control"), "no-store, private")
  assert.equal(calls.length, 0)
})

test("signed out: anything else hears 401", async () => {
  const res = await handleFileView(request("/api/files/fil_1/view", { accept: "*/*" }), "fil_1", deps(json(200, { url: SIGNED })))
  assert.equal(res.status, 401)
  assert.equal(res.headers.get("location"), null)
  assert.equal((await res.json()).error, "unauthorized")
})

test("a bearer the files API rejects clears the cookie and gets no file", async () => {
  const res = await handleFileView(request("/api/files/fil_1/view", { cookie: `${FILE_COOKIE}=${TOKEN}` }), "fil_1", deps(json(401, { error: "unauthorized" })))
  assert.equal(res.status, 302)
  assert.equal(res.headers.get("location"), "https://app.example/login")
  assert.match(res.headers.get("set-cookie"), /nutshell_files=;.*Max-Age=0/)
})

test("signed in with access: 302 to a fresh signed link, never cached or sent as a referrer", async () => {
  const calls = []
  const res = await handleFileView(
    request("/api/files/fil_1/view?v=2&team=Design", { cookie: `other=1; ${FILE_COOKIE}=${TOKEN}` }),
    "fil_1",
    deps(json(200, { url: SIGNED }), calls)
  )
  assert.equal(res.status, 302)
  assert.equal(res.headers.get("location"), SIGNED)
  assert.equal(res.headers.get("cache-control"), "no-store, private")
  assert.equal(res.headers.get("referrer-policy"), "no-referrer")
  assert.deepEqual(calls, [{ path: "/fs/files/fil_1/versions/2/link?inline=1", bearer: TOKEN, team: "Design" }])
})

test("downloads ask for an attachment link", async () => {
  const calls = []
  await handleFileView(request("/api/files/fil_1/view?download=1", { cookie: `${FILE_COOKIE}=${TOKEN}` }), "fil_1", deps(json(200, { url: SIGNED }), calls))
  assert.equal(calls[0].path, "/fs/files/fil_1/link")
})

test("no access and missing look the same: 404, no link", async () => {
  for (const status of [403, 404]) {
    const res = await handleFileView(request("/api/files/fil_1/view", { cookie: `${FILE_COOKIE}=${TOKEN}`, accept: "application/json" }), "fil_1", deps(json(status, { error: "forbidden" })))
    assert.equal(res.status, 404)
    assert.equal(res.headers.get("location"), null)
  }
})

test("a team you've left falls back to your default team, as the app does", async () => {
  const calls = []
  const reply = (n) => (n === 1 ? json(403, { error: "not_on_team" }) : json(200, { url: SIGNED }))
  const res = await handleFileView(request("/api/files/fil_1/view?team=Old", { cookie: `${FILE_COOKIE}=${TOKEN}` }), "fil_1", deps(reply, calls))
  assert.equal(res.status, 302)
  assert.deepEqual(calls.map((c) => c.team), ["Old", null])
})

test("only ever redirects to the files bucket", async () => {
  const res = await handleFileView(request("/api/files/fil_1/view", { cookie: `${FILE_COOKIE}=${TOKEN}` }), "fil_1", deps(json(200, { url: "https://evil.example/x" })))
  assert.equal(res.status, 502)
  assert.equal(res.headers.get("location"), null)
})

test("bad ids and versions never reach the files API", async () => {
  const calls = []
  const cookie = `${FILE_COOKIE}=${TOKEN}`
  assert.equal((await handleFileView(request("/api/files/x/view", { cookie }), "../folders", deps(json(200, { url: SIGNED }), calls))).status, 404)
  assert.equal((await handleFileView(request("/api/files/fil_1/view?v=0", { cookie }), "fil_1", deps(json(200, { url: SIGNED }), calls))).status, 400)
  assert.equal(calls.length, 0)
})

test("the session cookie needs the bearer in a header, and is HttpOnly, Lax, Secure, scoped to /api/files", () => {
  const none = handleFileSession(new Request("https://app.example/api/files/session", { method: "POST" }), true)
  assert.equal(none.status, 401)
  assert.equal(none.headers.get("set-cookie"), null)
  const ok = handleFileSession(new Request("https://app.example/api/files/session", { method: "POST", headers: { authorization: `Bearer ${TOKEN}` } }), true)
  assert.equal(ok.status, 204)
  const cookie = ok.headers.get("set-cookie")
  for (const part of ["HttpOnly", "SameSite=Lax", "Secure", "Path=/api/files"]) assert.ok(cookie.includes(part), part)
  assert.equal(readCookie(cookie.split(";")[0], FILE_COOKIE), TOKEN)
  const cleared = handleFileSession(new Request("https://app.example/api/files/session", { method: "DELETE" }), true)
  assert.match(cleared.headers.get("set-cookie"), /Max-Age=0/)
})

test("view paths are the app's own address", () => {
  assert.equal(fileViewPath("fil_1"), "/api/files/fil_1/view")
  assert.equal(fileViewPath("fil_1", { version: 3, download: true, team: "A B" }), "/api/files/fil_1/view?v=3&download=1&team=A+B")
})
