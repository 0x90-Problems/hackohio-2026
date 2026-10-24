"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const TAB_FOOTERS = [
  {
    path: "/projects",
    title: "Projects",
    description:
      "Each project has its own board, columns, tags, and tickets. Open a project to see its work.",
    href: "/teams",
    linkText: "Review team members",
  },
  {
    path: "/teams",
    title: "Teams",
    description:
      "Each agent belongs to a person. Review agent owners and scopes before connecting access.",
    href: "/agents",
    linkText: "Review agents",
  },
  {
    path: "/organization",
    title: "Organization",
    description:
      "Organization settings are a prototype and are not persisted as organization-wide policy.",
    href: "/agents",
    linkText: "Review agents and scopes",
  },
  {
    path: "/agents",
    title: "Agents",
    description:
      "Give each agent only the access it needs, and review its owner, scopes, and token status.",
    href: "/api",
    linkText: "View API setup",
  },
  {
    path: "/api",
    title: "API",
    description:
      "Use a scoped agent token for API access. The displayed localhost URL is for local development; OpenAPI docs are not published yet.",
    href: "/agents",
    linkText: "Manage agent tokens",
  },
]

export function TabFooter() {
  const pathname = usePathname()
  const footer = TAB_FOOTERS.find(
    ({ path }) => pathname === path || pathname.startsWith(`${path}/`)
  )

  if (!footer) return null

  const isProjectDetail = footer.path === "/projects" && pathname !== "/projects"
  const href = isProjectDetail ? "/projects" : footer.href
  const linkText = isProjectDetail ? "All projects" : footer.linkText

  return (
    <footer className="mt-8 border-t bg-muted/20">
      <div className="mx-auto flex max-w-screen-xl flex-col gap-2 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium">{footer.title}</h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {footer.description}
          </p>
        </div>
        <Link
          href={href}
          className="w-fit shrink-0 rounded-sm text-sm font-medium underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {linkText}
        </Link>
      </div>
    </footer>
  )
}
