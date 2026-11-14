// Where "Back to …" goes on the Connect agent and Create API key pages (NSB-68).
// The page is opened with ?from=<path>. Only a path inside this app is accepted, so a
// crafted link can't send someone (and a freshly copied token) to another site.

const MAX_LENGTH = 512

/** `raw` if it is a plain in-app path such as /agents or /projects/NSB, otherwise `fallback`. */
export function safeReturnPath(raw: string | null | undefined, fallback: string): string {
  if (typeof raw !== "string") return fallback
  const path = raw.trim()
  if (!path || path.length > MAX_LENGTH) return fallback
  // Must start with one slash: "//host" and "/\host" are read as another site.
  if (!path.startsWith("/") || path.startsWith("//")) return fallback
  // Browsers treat a backslash like a slash, so "/\evil" would be "//evil".
  if (path.includes("\\")) return fallback
  // Tabs and newlines are stripped by browsers ("/\t/evil" becomes "//evil"); no control characters at all.
  if (/[\u0000-\u001f\u007f]/.test(path)) return fallback
  // An encoded slash or backslash right after the first one could be decoded into "//".
  if (/^\/%(2f|5c)/i.test(path)) return fallback
  return path
}

const LABELS: [prefix: string, label: string][] = [
  ["/agents", "Agents"],
  ["/api", "API"],
  ["/projects", "Projects"],
  ["/organization", "Organization"],
  ["/teams", "Teams"],
  ["/profile", "Profile"],
]

/** The words after "Back to", from the path being returned to. */
export function returnLabel(path: string): string {
  const bare = path.split(/[?#]/, 1)[0]
  if (bare === "/") return "Home"
  const match = LABELS.find(([prefix]) => bare === prefix || bare.startsWith(`${prefix}/`))
  return match ? match[1] : "where you were"
}

/** A link to `page` that comes back to `from`, e.g. withReturn("/agents/connect", "/") -> "/agents/connect?from=%2F". */
export function withReturn(page: string, from: string): string {
  return `${page}?from=${encodeURIComponent(from)}`
}
