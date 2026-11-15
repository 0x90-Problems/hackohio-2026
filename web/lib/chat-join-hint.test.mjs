import assert from "node:assert/strict"
import test from "node:test"
import { joinHint } from "./chat-join-hint.ts"

test("no hint when you're in every public channel", () => {
  assert.equal(joinHint([]), null)
})

test("one channel is named, several are counted", () => {
  assert.equal(joinHint([{ name: "general" }]), "This team has a channel you haven't joined: #general.")
  assert.equal(joinHint([{ name: "general" }, { name: "random" }]), "This team has 2 channels you haven't joined.")
})
