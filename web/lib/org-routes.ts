// Which org calls the web app forwards to the board API (app/api/org/[...path]). Only the routes
// in the org contract go through, each with the methods it takes; the board authorizes every call.
// Dependency-free so node --test can load it.

const ORG = "org_[A-Za-z0-9]{4,40}"
const USER = "[A-Za-z0-9_.-]{1,100}"
const INVITE = "inv_[A-Za-z0-9]{4,40}"

const ROUTES: { pattern: RegExp; methods: string[]; query?: string[] }[] = [
  { pattern: /^me\/orgs$/, methods: ["GET"] },
  { pattern: /^me\/invites$/, methods: ["GET"] },
  { pattern: /^me\/membership$/, methods: ["GET"], query: ["team"] },
  { pattern: /^me\/email$/, methods: ["POST"] },
  { pattern: /^me\/email\/verify$/, methods: ["POST"] },
  { pattern: /^orgs$/, methods: ["POST"] },
  { pattern: new RegExp(`^orgs/${ORG}$`), methods: ["PATCH"] },
  { pattern: new RegExp(`^orgs/${ORG}/members$`), methods: ["GET"] },
  { pattern: new RegExp(`^orgs/${ORG}/members/${USER}$`), methods: ["DELETE"] },
  { pattern: new RegExp(`^orgs/${ORG}/leave$`), methods: ["POST"] },
  { pattern: new RegExp(`^orgs/${ORG}/invites$`), methods: ["GET", "POST"] },
  { pattern: new RegExp(`^orgs/${ORG}/invites/${INVITE}/(revoke|resend)$`), methods: ["POST"] },
  { pattern: /^invites\/preview$/, methods: ["GET"], query: ["token"] },
  { pattern: /^invites\/accept$/, methods: ["POST"] },
]

/** The board path for /api/org/<joined>, with only the query names that route takes; null if none. */
export function orgRoute(method: string, joined: string, search = ""): string | null {
  const route = ROUTES.find((candidate) => candidate.pattern.test(joined))
  if (!route || !route.methods.includes(method.toUpperCase())) return null
  const incoming = new URLSearchParams(search)
  const query = new URLSearchParams()
  for (const name of route.query ?? []) {
    const value = incoming.get(name)
    if (value !== null && value.length <= 300) query.set(name, value)
  }
  const rest = query.toString()
  return `/${joined}${rest ? `?${rest}` : ""}`
}
