"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import {
  BotIcon,
  Building2Icon,
  FolderIcon,
  FolderKanbanIcon,
  KeyRoundIcon,
  LayoutGridIcon,
  LogOutIcon,
  MessagesSquareIcon,
  MoonIcon,
  PenToolIcon,
  SunIcon,
  UserIcon,
  UsersIcon,
} from "@/components/icons"

import { clearSession, readSessionUser, subscribeAuth } from "@/lib/board-auth"
import { chatApi } from "@/lib/chat-api"
import { foldersApi } from "@/lib/folders-api"
import { useWhiteboardEnabled } from "@/lib/whiteboard-api"
import { Logo } from "@/components/logo"
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

// The launcher lists NutShell's services (not the page nav, which is already in
// the header). Services that aren't built yet show as "Soon" and can't be opened.
const SERVICES = [
  { label: "Boards", description: "Projects, tickets and roadmaps", href: "/projects", icon: FolderKanbanIcon },
  { label: "Folders", description: "Shared files and documents", icon: FolderIcon },
  { label: "Chat", description: "Team chat with channels", icon: MessagesSquareIcon },
  // Boards live in folders, so the tile opens Folders (create one with "New board").
  { label: "Whiteboard", description: "Draw live with people and agents", icon: PenToolIcon },
] as const

// Folders ship behind files.folders.enabled and Chat behind chat.enabled; ask once per page load.
let foldersCheck: Promise<boolean> | null = null
function foldersEnabled() {
  foldersCheck ??= foldersApi.enabled()
  return foldersCheck
}
let chatCheck: Promise<boolean> | null = null
function chatEnabled() {
  chatCheck ??= chatApi.enabled()
  return chatCheck
}

// Pages that show without the header.
const NO_HEADER = ["/login", "/signup"]

export function AppHeader() {
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const sessionUser = useSyncExternalStore(subscribeAuth, readSessionUser, () => null)
  const [foldersOn, setFoldersOn] = useState(false)
  const [chatOn, setChatOn] = useState(false)
  const whiteboardOn = useWhiteboardEnabled()

  useEffect(() => {
    let cancelled = false
    void foldersEnabled().then((on) => {
      if (!cancelled) setFoldersOn(on)
    })
    void chatEnabled().then((on) => {
      if (!cancelled) setChatOn(on)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (NO_HEADER.includes(pathname) || !sessionUser) return null

  const name = sessionUser.name
  const detail = sessionUser.role ?? sessionUser.team

  return (
    <header className="border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-3 px-4">
        {/* Left: app launcher + logo */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open NutShell apps">
              <LayoutGridIcon aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-80 p-2">
            <DropdownMenuLabel className="text-xs text-muted-foreground">NutShell apps</DropdownMenuLabel>
            <div className="grid grid-cols-2 gap-1">
              {SERVICES.map((base) =>
                base.label === "Folders" && foldersOn
                  ? { ...base, href: "/files" }
                  : base.label === "Chat" && chatOn
                    ? { ...base, href: "/chat" }
                    : base.label === "Whiteboard" && whiteboardOn && foldersOn
                      ? { ...base, href: "/boards" }
                      : base
              ).map((service) => {
                const tile = (
                  <>
                    <span className="flex size-9 items-center justify-center rounded-lg border bg-muted/40">
                      <service.icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      {service.label}
                      {!("href" in service) && (
                        <span className="rounded border border-dashed px-1 text-[10px] font-normal text-muted-foreground">
                          Soon
                        </span>
                      )}
                    </span>
                    <span className="text-xs leading-snug text-muted-foreground">{service.description}</span>
                  </>
                )
                return "href" in service ? (
                  <DropdownMenuItem
                    key={service.label}
                    asChild
                    className={cn(
                      "flex h-auto flex-col items-start gap-1 rounded-lg p-2.5 whitespace-normal",
                      pathname.startsWith(service.href) && "bg-muted"
                    )}
                  >
                    <Link href={service.href}>{tile}</Link>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    key={service.label}
                    disabled
                    aria-label={`${service.label}, coming soon`}
                    className="flex h-auto flex-col items-start gap-1 rounded-lg p-2.5 whitespace-normal"
                  >
                    {tile}
                  </DropdownMenuItem>
                )
              })}
            </div>
            {/* The page nav is hidden below xl, so the launcher carries it there. */}
            <div className="xl:hidden">
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/">Home</Link>
              </DropdownMenuItem>
              {NAV_LINKS.map((link) => (
                <DropdownMenuItem key={link.href} asChild>
                  <Link href={link.href}>
                    <link.icon className="size-4" aria-hidden="true" />
                    {link.label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <Link href="/" className="text-foreground">
          <Logo />
        </Link>

        {/* Center: main navigation (hidden on small screens; use the launcher there) */}
        <NavigationMenu viewport={false} className="mx-auto hidden xl:flex">
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
            <Button variant="ghost" className="ml-auto gap-2 xl:ml-0">
              <span className="text-sm">{name}</span>
              <HumanAvatar name={name} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>
              <div className="font-medium">{name}</div>
              <div className="text-xs font-normal text-muted-foreground">
                {detail}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile">
                <UserIcon aria-hidden="true" />
                Your profile
              </Link>
            </DropdownMenuItem>
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
              <Link
                href="/login"
                onClick={() => {
                  clearSession()
                }}
              >
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
