import assert from "node:assert/strict"
import test from "node:test"
import { commitUrl, isRepoName } from "./commit-links.ts"

test("a commit with a repo links to its commit page", () => {
  assert.equal(
    commitUrl({ sha: "ABC1234", repo: "hackohio-2026" }),
    "https://github.com/0x90-Problems/hackohio-2026/commit/abc1234",
  )
  const full = "0123456789abcdef0123456789abcdef01234567"
  assert.equal(
    commitUrl({ sha: full, repo: "Buc2AgentMCP" }),
    `https://github.com/0x90-Problems/Buc2AgentMCP/commit/${full}`,
  )
})

test("a commit without a usable repo links to an org commit search", () => {
  const search = "https://github.com/search?q=org%3A0x90-Problems+hash%3Aabc1234&type=commits"
  assert.equal(commitUrl({ sha: "abc1234" }), search)
  for (const repo of ["", "..", ".", "../evil", "a/b", "has space", "x?y", "x".repeat(101), 7, null]) {
    assert.equal(commitUrl({ sha: "abc1234", repo }), search, String(repo))
  }
})

test("a sha that isn't plain hex gets no link", () => {
  for (const sha of ["abc123", "abc1234g", "javascript:alert(1)", "abc1234/../x", "a".repeat(41), "", undefined, 1234567]) {
    assert.equal(commitUrl({ sha, repo: "hackohio-2026" }), undefined, String(sha))
  }
})

test("repo names follow GitHub's rules", () => {
  for (const name of ["hackohio-2026", "0x90-NextJS-Backend", "Buc2AgentTerraform", "a.b_c"]) {
    assert.equal(isRepoName(name), true, name)
  }
})
