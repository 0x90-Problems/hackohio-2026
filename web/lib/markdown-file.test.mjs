import assert from "node:assert/strict"
import test from "node:test"
import { isMarkdownFile } from "./markdown-file.ts"

test("text/markdown is markdown whatever the name", () => {
  assert.equal(isMarkdownFile({ name: "notes", content_type: "text/markdown" }), true)
  assert.equal(isMarkdownFile({ name: "notes.txt", content_type: "text/markdown; charset=utf-8" }), true)
})

test("a .md name counts when the browser said text/plain or nothing", () => {
  assert.equal(isMarkdownFile({ name: "README.md", content_type: "text/plain" }), true)
  assert.equal(isMarkdownFile({ name: "plan.Markdown" }), true)
  assert.equal(isMarkdownFile({ name: "notes.txt", content_type: "text/plain" }), false)
})

test("other types stay as they are, even named .md", () => {
  assert.equal(isMarkdownFile({ name: "data.md", content_type: "application/json" }), false)
  assert.equal(isMarkdownFile({ name: "photo.md", content_type: "image/png" }), false)
})
