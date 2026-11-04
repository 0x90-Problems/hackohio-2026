// GitHub links for a ticket's linked commits.
// Only a sha and repo that pass these patterns ever reach an href.

export const GITHUB_ORG = "0x90-Problems"

const SHA = /^[0-9a-f]{7,40}$/i
// GitHub repository names: letters, digits, dot, dash and underscore. "." and ".." are not names.
const REPO = /^[A-Za-z0-9._-]{1,100}$/

export function isCommitSha(value: unknown): value is string {
  return typeof value === "string" && SHA.test(value)
}

export function isRepoName(value: unknown): value is string {
  return typeof value === "string" && REPO.test(value) && !/^\.+$/.test(value)
}

// The commit page when the repo is known, otherwise a commit search across the org.
// Returns undefined when the sha is not a plain hex sha, so the caller shows plain text.
export function commitUrl(commit: { sha?: unknown; repo?: unknown }): string | undefined {
  if (!isCommitSha(commit.sha)) return undefined
  const sha = commit.sha.toLowerCase()
  if (isRepoName(commit.repo)) {
    return `https://github.com/${GITHUB_ORG}/${commit.repo}/commit/${sha}`
  }
  return `https://github.com/search?q=org%3A${GITHUB_ORG}+hash%3A${sha}&type=commits`
}
