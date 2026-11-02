import assert from "node:assert/strict"
import test from "node:test"

import { Autosaver } from "./whiteboard-autosave.ts"
import { exportFileName, imageFileName, imageProblem, ImageLoader, isFileRef, versionFileName } from "./whiteboard-files.ts"
import { describeRow, matchesFilter, outlineOf } from "./whiteboard-outline.ts"

const shape = (id, type, extra = {}) => ({ id, type, x: 0, y: 0, ...extra })

test("the outline reads top to bottom, then left to right, and leaves out deleted shapes", () => {
  const rows = outlineOf([shape("low", "rectangle", { y: 100 }), shape("right", "ellipse", { y: 10, x: 50 }), shape("left", "diamond", { y: 10, x: 5 }), shape("gone", "rectangle", { isDeleted: true })])
  assert.deepEqual(rows.map((r) => [r.id, r.kind]), [["left", "Diamond"], ["right", "Ellipse"], ["low", "Rectangle"]])
})

test("a shape's label shows on the shape, not as its own row", () => {
  const rows = outlineOf([
    shape("box", "rectangle", { boundElements: [{ id: "t", type: "text" }] }),
    shape("t", "text", { containerId: "box", text: "  Log\n in " }),
    shape("note", "text", { text: "Loose note" }),
  ])
  assert.deepEqual(rows.map((r) => [r.id, r.label]), [["box", "Log in"], ["note", "Loose note"]])
})

test("a label whose shape was deleted still appears", () => {
  const rows = outlineOf([shape("box", "rectangle", { isDeleted: true }), shape("t", "text", { containerId: "box", text: "Orphan" })])
  assert.deepEqual(rows.map((r) => r.label), ["Orphan"])
})

test("arrows say what they connect, using the other shapes' labels", () => {
  const rows = outlineOf([
    shape("a", "rectangle", { y: 0, boundElements: [{ id: "ta", type: "text" }] }),
    shape("ta", "text", { containerId: "a", text: "Start" }),
    shape("b", "ellipse", { y: 10 }),
    shape("go", "arrow", { y: 20, startBinding: { elementId: "a" }, endBinding: { elementId: "b" } }),
    shape("half", "arrow", { y: 30, endBinding: { elementId: "a" } }),
    shape("dangling", "arrow", { y: 40, startBinding: { elementId: "deleted-one" } }),
  ])
  assert.deepEqual(rows.slice(2).map((r) => r.label), ["from Start to ellipse", "to Start", ""])
})

test("shapes in a frame come straight after it", () => {
  const rows = outlineOf([
    shape("before", "rectangle", { y: 0 }),
    shape("f", "frame", { y: 10, name: "Sprint" }),
    shape("in2", "ellipse", { y: 40, frameId: "f" }),
    shape("in1", "ellipse", { y: 20, frameId: "f" }),
    shape("after", "rectangle", { y: 30 }),
    shape("lost", "rectangle", { y: 50, frameId: "deleted-frame" }),
  ])
  assert.deepEqual(rows.map((r) => [r.id, r.inFrame]), [["before", false], ["f", false], ["in1", true], ["in2", true], ["after", false], ["lost", false]])
  assert.equal(rows[1].label, "Sprint")
})

test("rows say in words what they are, including who added them", () => {
  const [row] = outlineOf([shape("x", "image", { customData: { created_by: { type: "agent", id: "a" } } })])
  assert.equal(row.byAgent, true)
  assert.equal(describeRow(row), "Image, added by an agent")
  assert.equal(describeRow({ id: "y", kind: "Text", label: "Hi", inFrame: true, byAgent: false }), "Text: Hi, in the frame above")
  assert.equal(outlineOf([shape("z", "something-new")])[0].kind, "Shape")
})

test("long labels are cut and the filter looks at kind and label", () => {
  const [row] = outlineOf([shape("t", "text", { text: "x".repeat(500) })])
  assert.equal(row.label.length, 120)
  assert.ok(row.label.endsWith("…"))
  assert.equal(matchesFilter({ kind: "Rectangle", label: "Login" }, " logi "), true)
  assert.equal(matchesFilter({ kind: "Rectangle", label: "Login" }, "rect"), true)
  assert.equal(matchesFilter({ kind: "Rectangle", label: "Login" }, "arrow"), false)
  assert.equal(matchesFilter({ kind: "Rectangle", label: "" }, ""), true)
})

test("only Files node ids count as image references", () => {
  assert.equal(isFileRef("fil_18c0abc"), true)
  for (const bad of ["", null, undefined, 7, "data:image/png;base64,AAAA", "https://x/y.png", "fld_1", "wbd_1", "fil_", "fil_a/b", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4"]) {
    assert.equal(isFileRef(bad), false, String(bad))
  }
})

test("SVG, HTML and oversized files can't go on a board", () => {
  assert.equal(imageProblem({ type: "image/png", size: 100 }), null)
  assert.equal(imageProblem({ type: "image/webp", size: 10 * 1024 * 1024 }), null)
  assert.match(imageProblem({ type: "image/svg+xml", size: 100 }), /PNG, JPEG, GIF and WebP/)
  assert.match(imageProblem({ type: "text/html", size: 100 }), /PNG, JPEG, GIF and WebP/)
  assert.match(imageProblem({ type: "image/png", size: 10 * 1024 * 1024 + 1 }), /too large/)
})

test("files a board creates get names that won't clash or run long", () => {
  assert.equal(imageFileName("Plan", "image/jpeg", "ab12"), "Plan image ab12.jpg")
  assert.equal(imageFileName("  ", "image/png", "ab12"), "Whiteboard image ab12.png")
  assert.equal(exportFileName("Plan", "svg", new Date(2026, 10, 1, 9, 5)), "Plan 2026-11-01 0905.svg")
  assert.equal(versionFileName("Plan", 3), "Plan v3.excalidraw")
  assert.ok(imageFileName("x".repeat(400), "image/png", "ab12").length <= 255)
  assert.doesNotMatch(exportFileName("Plan", "png", new Date()), /[/\\:]/)
})

const tick = () => new Promise((resolve) => setImmediate(resolve))

function deferredFetcher() {
  const calls = []
  const fetchOne = (id) => new Promise((resolve, reject) => calls.push({ id, resolve: () => resolve({ id, mimeType: "image/png", dataURL: "data:x", created: 1 }), reject }))
  return { calls, fetchOne }
}

test("images load at most three at a time, once each", async () => {
  const { calls, fetchOne } = deferredFetcher()
  const loaded = []
  const loader = new ImageLoader(fetchOne, (image) => loaded.push(image.id))
  loader.need(["fil_1", "fil_2", "fil_3", "fil_4", "fil_1", "not-a-ref"])
  loader.need(["fil_1"])
  assert.deepEqual(calls.map((c) => c.id), ["fil_1", "fil_2", "fil_3"])
  calls[0].resolve()
  await tick()
  assert.deepEqual(calls.map((c) => c.id), ["fil_1", "fil_2", "fil_3", "fil_4"])
  assert.deepEqual(loaded, ["fil_1"])
  loader.stop()
})

test("an export waits for every image, and an image already here isn't fetched", async () => {
  const { calls, fetchOne } = deferredFetcher()
  const loaded = []
  const loader = new ImageLoader(fetchOne, (image) => loaded.push(image.id))
  await loader.settled() // nothing to wait for
  loader.have("fil_mine")
  loader.need(["fil_mine", "fil_1"])
  assert.deepEqual(calls.map((c) => c.id), ["fil_1"])
  let done = false
  void loader.settled().then(() => (done = true))
  await tick()
  assert.equal(done, false)
  calls[0].resolve()
  await tick()
  assert.equal(done, true)
  assert.deepEqual(loaded, ["fil_1"])
})

test("an image someone can't read is left alone, and a passing failure is retried a few times", async () => {
  let fetches = 0
  const loader = new ImageLoader(
    async () => {
      fetches++
      throw Object.assign(new Error("no"), { status: 404 })
    },
    () => assert.fail("nothing loads"),
    1
  )
  loader.need(["fil_1"])
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.equal(fetches, 1)

  let tries = 0
  const flaky = new ImageLoader(
    async (id) => {
      if (++tries < 3) throw Object.assign(new Error("throttled"), { status: 503 })
      return { id, mimeType: "image/png", dataURL: "data:x", created: 1 }
    },
    (image) => (flaky.got = image.id),
    1
  )
  flaky.need(["fil_2"])
  await new Promise((resolve) => setTimeout(resolve, 30))
  assert.equal(tries, 3)
  assert.equal(flaky.got, "fil_2")

  let attempts = 0
  const down = new ImageLoader(
    async () => {
      attempts++
      throw new Error("offline")
    },
    () => assert.fail("nothing loads"),
    1
  )
  down.need(["fil_3"])
  await new Promise((resolve) => setTimeout(resolve, 30))
  assert.equal(attempts, 3) // then it stops asking
  await down.settled()
})

function saverHarness(t, replies) {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const asked = { count: 0 }
  const saved = []
  const saver = new Autosaver(
    async () => {
      asked.count++
      const reply = replies.shift()
      if (reply instanceof Error) throw reply
      return reply ?? { saved: false, dirty: false }
    },
    (version) => saved.push(version),
    () => 0 // no jitter
  )
  return { saver, asked, saved }
}

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

test("a tab nobody edits in asks once when it opens, then stays quiet", async (t) => {
  const { saver, asked } = saverHarness(t, [{ saved: false, dirty: false }])
  saver.start()
  t.mock.timers.tick(0)
  await flush()
  assert.equal(asked.count, 1)
  t.mock.timers.tick(3_600_000)
  await flush()
  assert.equal(asked.count, 1)
  saver.stop()
})

test("an edit brings a check, and the server's answer sets the next one", async (t) => {
  const { saver, asked, saved } = saverHarness(t, [{ saved: false, dirty: true, due_in: 600 }, { saved: true, version: 4 }])
  saver.noteEdit()
  saver.noteEdit() // a burst of edits is one check
  t.mock.timers.tick(29_999)
  await flush()
  assert.equal(asked.count, 0)
  t.mock.timers.tick(1)
  await flush()
  assert.equal(asked.count, 1)
  t.mock.timers.tick(599_999)
  await flush()
  assert.equal(asked.count, 1)
  t.mock.timers.tick(1)
  await flush()
  assert.equal(asked.count, 2)
  assert.deepEqual(saved, [4])
  t.mock.timers.tick(3_600_000) // saved, nothing since: quiet
  await flush()
  assert.equal(asked.count, 2)
  saver.noteEdit() // the next edit starts it again
  t.mock.timers.tick(30_000)
  await flush()
  assert.equal(asked.count, 3)
  saver.stop()
})

test("a failed check tries again later, and someone who can't save stops asking", async (t) => {
  const { saver, asked } = saverHarness(t, [new Error("network"), Object.assign(new Error("no"), { status: 403 })])
  saver.start()
  t.mock.timers.tick(0)
  await flush()
  assert.equal(asked.count, 1)
  t.mock.timers.tick(60_000)
  await flush()
  assert.equal(asked.count, 2)
  saver.noteEdit()
  t.mock.timers.tick(3_600_000)
  await flush()
  assert.equal(asked.count, 2)
})

test("an edit made during a check isn't forgotten", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  let answer
  let count = 0
  const saver = new Autosaver(
    () => {
      count++
      return new Promise((resolve) => (answer = resolve))
    },
    () => undefined,
    () => 0
  )
  saver.start()
  t.mock.timers.tick(0)
  await flush()
  assert.equal(count, 1)
  saver.noteEdit()
  answer({ saved: false, dirty: false })
  await flush()
  t.mock.timers.tick(30_000)
  await flush()
  assert.equal(count, 2)
  saver.stop()
})
