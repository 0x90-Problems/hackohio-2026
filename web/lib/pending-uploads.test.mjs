import assert from "node:assert/strict"
import test from "node:test"
import { isFinalRefusal, parsePending, settlePending } from "./pending-uploads.ts"

const now = 1_800_000_000_000
const hour = 3600 * 1000
const upload = (id, at = now) => ({ upload_id: id, name: `${id}.txt`, at })
const statusOf = (error) => ({ status: error.status, message: error.message })
const failure = (status, message = "no") => Object.assign(new Error(message), { status })

test("reads back what was saved, and ignores anything it can't use", () => {
  assert.deepEqual(parsePending(JSON.stringify([upload("a")]), now), [upload("a")])
  assert.deepEqual(parsePending(null, now), [])
  assert.deepEqual(parsePending("not json", now), [])
  assert.deepEqual(parsePending('{"upload_id":"a"}', now), [])
  assert.deepEqual(parsePending('[null,{"upload_id":1},{"upload_id":"a","name":"x"}]', now), [])
})

test("an upload that never arrived is dropped after a day", () => {
  assert.deepEqual(parsePending(JSON.stringify([upload("old", now - 25 * hour), upload("new", now - hour)]), now), [upload("new", now - hour)])
})

test("a finished scan adds the file, and one still going is kept", async () => {
  const result = await settlePending([upload("done"), upload("scanning")], async (id) => (id === "done" ? "added" : "pending"), statusOf)
  assert.deepEqual(result.settled, [{ upload: upload("done"), outcome: "added" }])
  assert.deepEqual(result.waiting, [upload("scanning")])
})

test("a refused file is reported once, with the server's reason", async () => {
  const result = await settlePending(
    [upload("virus")],
    async () => {
      throw failure(422, "the file failed the security scan")
    },
    statusOf
  )
  assert.deepEqual(result.settled, [{ upload: upload("virus"), outcome: "refused", message: "the file failed the security scan" }])
  assert.deepEqual(result.waiting, [])
})

test("being offline or a server error doesn't lose the upload", async () => {
  for (const status of [0, 408, 429, 500, 503]) {
    const result = await settlePending(
      [upload("a")],
      async () => {
        throw failure(status)
      },
      statusOf
    )
    assert.deepEqual(result, { settled: [], waiting: [upload("a")] }, `status ${status}`)
  }
})

test("one bad answer doesn't stop the others", async () => {
  const result = await settlePending(
    [upload("a"), upload("b"), upload("c")],
    async (id) => {
      if (id === "a") throw failure(500)
      if (id === "b") throw failure(404, "upload not found")
      return "added"
    },
    statusOf
  )
  assert.deepEqual(result.waiting, [upload("a")])
  assert.deepEqual(result.settled.map((item) => [item.upload.upload_id, item.outcome]), [["b", "refused"], ["c", "added"]])
})

test("only a client error is final", () => {
  assert.deepEqual([404, 409, 422].map(isFinalRefusal), [true, true, true])
  assert.deepEqual([0, 200, 408, 429, 500].map(isFinalRefusal), [false, false, false, false, false])
})
