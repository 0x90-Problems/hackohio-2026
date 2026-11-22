import assert from "node:assert/strict"
import test from "node:test"
import { EDGE, MAX_SPEED, edgeSpeed } from "./drag-scroll.ts"

test("no scrolling away from the edges", () => {
  assert.equal(edgeSpeed(500, 0, 1000), 0)
  assert.equal(edgeSpeed(EDGE, 0, 1000), 0)
  assert.equal(edgeSpeed(1000 - EDGE, 0, 1000), 0)
})

test("near an edge it scrolls toward it, fastest right at the edge", () => {
  assert.ok(edgeSpeed(EDGE - 10, 0, 1000) < 0)
  assert.ok(edgeSpeed(1000 - EDGE + 10, 0, 1000) > 0)
  assert.equal(edgeSpeed(0, 0, 1000), -MAX_SPEED)
  assert.equal(edgeSpeed(1000, 0, 1000), MAX_SPEED)
  assert.ok(Math.abs(edgeSpeed(5, 0, 1000)) > Math.abs(edgeSpeed(60, 0, 1000)))
})

test("outside the area, or an area too small to have a middle, never scrolls", () => {
  assert.equal(edgeSpeed(-5, 0, 1000), 0)
  assert.equal(edgeSpeed(1005, 0, 1000), 0)
  assert.equal(edgeSpeed(10, 0, 150), 0)
})
