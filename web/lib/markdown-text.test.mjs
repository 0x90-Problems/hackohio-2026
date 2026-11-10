import assert from "node:assert/strict"
import test from "node:test"
import { looksLikeMarkdown, plainSnippet, withLineBreaks } from "./markdown-text.ts"

test("plain sentences don't need the renderer", () => {
  assert.equal(looksLikeMarkdown("Looks good, merging now."), false)
  assert.equal(looksLikeMarkdown("Ping @user_abc about it"), false)
  assert.equal(looksLikeMarkdown("Done.\nNext up: tests"), false)
})

test("markdown marks do", () => {
  for (const text of ["**bold**", "use `npm ci`", "# Title", "- one\n- two", "1. first", "> quoted", "[docs](https://x.y)", "```\ncode\n```", "see [[Plan]]"]) {
    assert.equal(looksLikeMarkdown(text), true, text)
  }
})

test("single line breaks stay line breaks", () => {
  assert.equal(withLineBreaks("one\ntwo\nthree"), "one\\\ntwo\\\nthree")
  assert.equal(withLineBreaks("para\n\nnext"), "para\n\nnext")
})

test("lists, headings and code blocks are left alone", () => {
  assert.equal(withLineBreaks("Steps:\n- a\n- b"), "Steps:\n- a\n- b")
  assert.equal(withLineBreaks("```\nx = 1\ny = 2\n```"), "```\nx = 1\ny = 2\n```")
  assert.equal(withLineBreaks("Intro\n# Heading"), "Intro\n# Heading")
})

test("snippets drop the marks but keep the words", () => {
  assert.equal(plainSnippet("**Fixed** the `build`, see [the PR](https://x.y)\n- one"), "Fixed the build, see the PR one")
  assert.equal(plainSnippet("# Plan\nShip [[Roadmap|it]]"), "Plan Ship Roadmap")
})
