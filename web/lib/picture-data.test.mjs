import assert from "node:assert/strict"
import test from "node:test"
import { MAX_PICTURE_BYTES, dataUrlBytes, fitPicture, safePicture } from "./picture-data.ts"

const url = (bytes, type = "webp") => `data:image/${type};base64,${Buffer.alloc(bytes, 7).toString("base64")}`

test("only small PNG, JPEG or WebP data URLs are shown", () => {
  assert.ok(safePicture(url(100)))
  assert.ok(safePicture(url(100, "png")))
  assert.ok(safePicture(url(100, "jpeg")))
  assert.equal(safePicture("https://tracker.example/me.png"), undefined)
  assert.equal(safePicture(url(100, "svg+xml")), undefined)
  assert.equal(safePicture(url(100, "gif")), undefined)
  assert.equal(safePicture("data:image/png;base64,<script>"), undefined)
  assert.equal(safePicture(url(MAX_PICTURE_BYTES + 2000)), undefined)
  assert.equal(safePicture(null), undefined)
})

test("decoded size is measured from the base64", () => {
  assert.equal(dataUrlBytes(url(1000)), 1000)
  assert.equal(dataUrlBytes(url(1001)), 1001)
  assert.equal(dataUrlBytes(url(1002)), 1002)
})

test("shrinking steps size and quality down until it fits", async () => {
  const tried = []
  // Pretend bytes = size^2 * quality: the first tries (192px, high quality) are too big.
  const picture = await fitPicture(async (size, quality) => {
    tried.push([size, quality])
    return url(Math.round(size * size * quality))
  })
  assert.ok(dataUrlBytes(picture) <= MAX_PICTURE_BYTES)
  assert.deepEqual(tried[0], [192, 0.9], "tries the largest, best first")
  assert.ok(tried.length > 1)
  await assert.rejects(fitPicture(async () => url(MAX_PICTURE_BYTES + 1)), /too detailed/)
})
