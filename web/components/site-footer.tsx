import Link from "next/link"

import { TEAM } from "@/lib/mock-data"

const COLUMNS = [
  {
    heading: "Product",
    links: [
      { href: "/projects", label: "Projects" },
      { href: "/teams", label: "Teams" },
      { href: "/organization", label: "Organization" },
    ],
  },
  {
    heading: "Agents",
    links: [
      { href: "/agents", label: "Connect an agent" },
      { href: "/api", label: "MCP setup" },
      { href: "/api", label: "API keys" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { href: "/api", label: "OpenAPI reference" },
      {
        href: "https://github.com/0x90-Problems",
        label: "GitHub · 0x90-Problems",
      },
    ],
  },
]

// Footer from the Home wireframe: brand, link columns, and where it was built.
export function SiteFooter() {
  return (
    <footer className="mt-12 border-t bg-muted/40">
      <div className="mx-auto flex max-w-screen-2xl flex-col gap-8 px-4 py-10">
        <p className="text-lg font-semibold">NutShell</p>
        <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-4">
          {COLUMNS.map((column) => (
            <nav
              key={column.heading}
              aria-label={column.heading}
              className="flex flex-col gap-2"
            >
              <h2 className="font-semibold">{column.heading}</h2>
              {column.links.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          ))}
          <div className="flex flex-col gap-2">
            <h2 className="font-semibold">Built at</h2>
            <p className="text-muted-foreground">HackOHI/O 2026</p>
            <p className="text-muted-foreground">Ohio Union, Columbus</p>
            <p className="text-muted-foreground">Team {TEAM}</p>
          </div>
        </div>
        <p className="border-t pt-6 text-xs text-muted-foreground">
          © 2026 {TEAM}. Built in 24 hours.
        </p>
      </div>
    </footer>
  )
}
