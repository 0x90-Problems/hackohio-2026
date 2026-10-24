"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { LayoutGridIcon, LogOutIcon, MoonIcon, SunIcon } from "lucide-react"

import { currentUser } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import { HumanAvatar } from "@/components/actor-badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"

const NAV_LINKS = [
  { href: "/board", label: "Board" },
  { href: "/teams", label: "Teams" },
  { href: "/organization", label: "Organization" },
  { href: "/agents", label: "Agents" },
  { href: "/api", label: "API" },
]

// Pages that show without the header.
const NO_HEADER = ["/login"]

export function AppHeader() {
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()

  if (NO_HEADER.includes(pathname)) return null

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-3 px-4">
        {/* Left: app launcher + logo */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open app launcher">
              <LayoutGridIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem asChild>
              <Link href="/">Home</Link>
            </DropdownMenuItem>
            {NAV_LINKS.map((link) => (
              <DropdownMenuItem key={link.href} asChild>
                <Link href={link.href}>{link.label}</Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="size-6 rounded-md bg-primary" aria-hidden />
          buck2agents
        </Link>

        {/* Center: main navigation (hidden on small screens; use the launcher there) */}
        <NavigationMenu viewport={false} className="mx-auto hidden md:flex">
          <NavigationMenuList>
            {NAV_LINKS.map((link) => {
              const active = pathname.startsWith(link.href)
              return (
                <NavigationMenuItem key={link.href}>
                  <NavigationMenuLink
                    asChild
                    active={active}
                    className={cn(
                      navigationMenuTriggerStyle(),
                      "text-muted-foreground data-active:bg-muted data-active:text-foreground"
                    )}
                  >
                    <Link href={link.href}>{link.label}</Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              )
            })}
          </NavigationMenuList>
        </NavigationMenu>

        {/* Right: current user */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="ml-auto gap-2 md:ml-0">
              <span className="text-sm">{currentUser.name}</span>
              <HumanAvatar name={currentUser.name} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>
              <div className="font-medium">{currentUser.name}</div>
              <div className="text-xs font-normal text-muted-foreground">
                {currentUser.role}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            >
              {resolvedTheme === "dark" ? <SunIcon /> : <MoonIcon />}
              {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/login">
                <LogOutIcon />
                Log out
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
