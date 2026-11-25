import assert from "node:assert/strict"
import test from "node:test"
import { BlockError, checkBlock, upgradeBlock } from "./a2ui-block.ts"
import { BLOCK_TEMPLATES } from "./a2ui-templates.ts"

test("every editor template passes the same check the board runs", () => {
  assert.ok(BLOCK_TEMPLATES.length >= 5)
  for (const template of BLOCK_TEMPLATES) assert.ok(checkBlock(template.block), template.id)
})

test("the web copy refuses what the board refuses", () => {
  const refuse = (raw) => assert.throws(() => checkBlock(raw), BlockError)
  refuse({ version: "v0.9", components: [{ id: "root", component: "Image", url: "https://tracker.example/p.gif" }] })
  refuse({ version: "1.0", components: [{ id: "root", component: "Text", text: { "@path": "/x" } }] })
  refuse({ version: "v0.9", components: [{ id: "root", component: "TextField" }] })
  refuse({ version: "v0.9", components: [{ id: "root", component: "Button", child: "l", action: { functionCall: { call: "openUrl", args: { url: "javascript:alert(1)" } } } }, { id: "l", component: "Text", text: "x" }] })
})

test("blocks stored as v0.9 read back as v1.0", () => {
  const old = { version: "v0.9", components: [{ id: "root", component: "Text", text: "Done", variant: "h2" }] }
  assert.deepEqual(checkBlock(old), { version: "1.0", components: [{ id: "root", component: "Text", text: "## Done" }] })
  assert.equal(upgradeBlock(old).version, "1.0")
})
