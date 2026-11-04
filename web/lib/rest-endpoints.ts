import { SCOPES, type Scope } from "@/shared/names"

export type RestMethod = "GET" | "POST" | "PATCH"

export type RestEndpoint = {
  method: RestMethod
  path: string
  description: string
  // The scope the key needs, or null when no key is needed.
  scope: Scope | null
}

// Routes the board REST API serves today (0x90-NextJS-Backend src/http.ts).
export const REST_ENDPOINTS: RestEndpoint[] = [
  { method: "GET", path: "/tickets", description: "List tickets. Query status", scope: SCOPES.TICKETS_READ },
  { method: "POST", path: "/tickets", description: "Create a ticket in Backlog", scope: SCOPES.TICKETS_WRITE },
  { method: "GET", path: "/tickets/:key", description: "Read one ticket", scope: SCOPES.TICKETS_READ },
  { method: "PATCH", path: "/tickets/:key", description: "Edit, move or close a ticket", scope: SCOPES.TICKETS_WRITE },
  { method: "GET", path: "/tickets/:key/comments", description: "List comments on a ticket", scope: SCOPES.TICKETS_READ },
  { method: "POST", path: "/tickets/:key/comments", description: "Add a comment", scope: SCOPES.COMMENTS_WRITE },
  { method: "GET", path: "/events", description: "Newest board changes. Query since", scope: SCOPES.TICKETS_READ },
  { method: "GET", path: "/projects", description: "List projects with their layout and fields", scope: SCOPES.TICKETS_READ },
  { method: "POST", path: "/projects", description: "Create a project from a template", scope: SCOPES.TICKETS_WRITE },
  { method: "GET", path: "/projects/:key/table", description: "Read one project as table groups and rows", scope: SCOPES.TICKETS_READ },
  { method: "GET", path: "/project-templates", description: "List templates (board, table, or roadmap)", scope: SCOPES.TICKETS_READ },
  { method: "GET", path: "/project-templates/:id", description: "Layout, columns, fields, and starter tags for one template", scope: SCOPES.TICKETS_READ },
  { method: "GET", path: "/health", description: "Is the API up. No key needed", scope: null },
]
