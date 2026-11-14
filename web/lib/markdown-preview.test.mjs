import assert from "node:assert/strict"
import test from "node:test"
import { highlightTokens, previewText, previewTokens } from "./markdown-preview.ts"

const marked = (tokens) => tokens.map((t) => (t.marks.length ? `${t.marks.join("+")}:${t.text}` : t.text))

test("inline marks become tokens", () => {
  assert.deepEqual(marked(previewTokens("**Fixed** the `build`, see [the PR](https://x.y)")), [
    "strong:Fixed",
    " the ",
    "code:build",
    ", see ",
    "link:the PR",
  ])
  assert.deepEqual(marked(previewTokens("a *b* _c_ ~~d~~")), ["a ", "em:b", " ", "em:c", " ", "strike:d"])
})

test("nested marks and escapes", () => {
  assert.deepEqual(marked(previewTokens("**bold _and em_**")), ["strong:bold ", "strong+em:and em"])
  assert.equal(previewText(previewTokens("2 \\* 3 and user_abc_def")), "2 * 3 and user_abc_def")
})

test("blocks flatten into one line", () => {
  assert.equal(previewText(previewTokens("# Plan\n- one\n- [x] two\n1. three")), "Plan • one ☑ two 1. three")
  assert.equal(previewText(previewTokens("Run:\n```sh\nnpm ci\nnpm test\n```")), "Run: npm ci npm test")
  assert.equal(previewText(previewTokens("> quoted\n\n| a | b |\n|---|---|\n| 1 | 2 |")), "quoted a · b 1 · 2")
  assert.equal(previewText(previewTokens("See [[Roadmap|the plan]] and ![logo](x.png)")), "See the plan and logo")
})

test("long text is cut with an ellipsis", () => {
  assert.equal(previewText(previewTokens("x".repeat(50), 10)), `${"x".repeat(10)}…`)
})

test("search hits are marked inside the shown words", () => {
  const hit = highlightTokens(previewTokens("Fixed the **deploy script** today"), "loy scr")
  assert.deepEqual(marked(hit), ["Fixed the ", "strong:dep", "strong+hit:loy scr", "strong:ipt", " today"])
})

test("a hit that spans marks is split per token", () => {
  const hit = highlightTokens(previewTokens("run `npm ci` now"), "ci now")
  assert.deepEqual(marked(hit), ["run ", "code:npm ", "code+hit:ci", "hit: now"])
})

test("no hit in the shown words means plain fallback", () => {
  assert.equal(highlightTokens(previewTokens("[docs](https://example.com/guide)"), "example"), null)
  assert.equal(highlightTokens(previewTokens("anything"), "  "), null)
})

test("the window trims around the hit", () => {
  const hit = highlightTokens(previewTokens(`${"a".repeat(100)} needle ${"b".repeat(100)}`), "needle", 40, 10)
  const text = previewText(hit)
  assert.ok(text.startsWith("…") && text.endsWith("…"))
  assert.ok(text.includes("needle"))
})
