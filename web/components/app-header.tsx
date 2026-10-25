"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import {
  BotIcon,
  Building2Icon,
  FolderKanbanIcon,
  KeyRoundIcon,
  LayoutGridIcon,
  LogOutIcon,
  MoonIcon,
  SunIcon,
  UsersIcon,
} from "@/components/icons"

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
  { href: "/projects", label: "Projects", icon: FolderKanbanIcon },
  { href: "/teams", label: "Teams", icon: UsersIcon },
  { href: "/organization", label: "Organization", icon: Building2Icon },
  { href: "/agents", label: "Agents", icon: BotIcon },
  { href: "/api", label: "API", icon: KeyRoundIcon },
]

// Pages that show without the header.
const NO_HEADER = ["/login"]

export function AppHeader() {
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()

  if (NO_HEADER.includes(pathname)) return null

  return (
    <header className="border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-3 px-4">
        {/* Left: app launcher + logo */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open app launcher">
              <LayoutGridIcon aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem asChild>
              <Link href="/">Home</Link>
            </DropdownMenuItem>
            {NAV_LINKS.map((link) => (
              <DropdownMenuItem key={link.href} asChild>
                <Link href={link.href}>
                  {link.icon && <link.icon className="size-4" aria-hidden="true" />}
                  {link.label}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Link href="/" className="flex items-center gap-2 font-semibold">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.png" alt="" className="size-7" aria-hidden />
          NutShell
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
                    <Link href={link.href} className="gap-2">
                      {link.icon && <link.icon className="size-5" aria-hidden="true" />}
                      {link.label}
                    </Link>
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
              {resolvedTheme === "dark" ? (
                <SunIcon aria-hidden="true" />
              ) : (
                <MoonIcon aria-hidden="true" />
              )}
              {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/login">
                <LogOutIcon aria-hidden="true" />
                Log out
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
