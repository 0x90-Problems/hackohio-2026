// The board REST API, for scripts, CI and integrations. AI agents use MCP
// instead (lib/mcp-install.ts, shown on the Agents page).
// NEXT_PUBLIC_BOARD_API_URL overrides the public address shown on the API page.
// Pure so it can be unit tested.

// The AWS board HTTP API. Same origin the site's /api routes forward to.
export const DEFAULT_BOARD_API_URL = "https://um433hdwe5.execute-api.us-east-1.amazonaws.com"

export function boardApiPublicUrl(configured = process.env.NEXT_PUBLIC_BOARD_API_URL): string {
  const value = configured?.trim()
  if (value) {
    try {
      const url = new URL(value)
      if (url.protocol === "https:" || url.protocol === "http:") return value.replace(/\/+$/, "")
    } catch {
      // fall through to the default
    }
  }
  return DEFAULT_BOARD_API_URL
}

/** A copy-paste curl call that lists tickets with a key from $NUTSHELL_API_KEY. */
export function curlExample(baseUrl: string, envVar = "NUTSHELL_API_KEY"): string {
  return `curl -s ${baseUrl}/tickets -H "Authorization: Bearer $${envVar}"`
}

/**
 * Keeps the rows made for one connection type: API keys on the API page, MCP
 * agents on the Agents page. A row with no connection is an older MCP agent.
 */
export function onlyConnection<T extends { connection?: string | null }>(
  rows: T[],
  wanted: string,
  missing: string,
): T[] {
  return rows.filter((row) => (row.connection || missing) === wanted)
}
