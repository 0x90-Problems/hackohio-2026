"use client"

import type { Scope } from "@/shared/names"
import { groupScopes, scopeSummary } from "@/lib/scope-groups"
import { cn } from "@/lib/utils"
import { ScopeBadge } from "@/components/scope-badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

// A token's scopes in short ("13 scopes" over "Tickets, Folders, Chat"),
// opening to the full list grouped by area on click.
export function ScopeSummary({
  scopes,
  className,
}: {
  scopes: readonly Scope[]
  className?: string
}) {
  const groups = groupScopes(scopes)
  const { count, areas } = scopeSummary(scopes)
  if (groups.length === 0) {
    return <span className={cn("text-sm text-muted-foreground", className)}>{count}</span>
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${count}: ${areas}. Show all`}
          className={cn(
            "flex max-w-56 flex-col items-start rounded-md px-1.5 py-1 text-left transition-colors -mx-1.5 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none data-[state=open]:bg-muted",
            className
          )}
        >
          <span className="text-sm font-medium underline decoration-dotted underline-offset-4">{count}</span>
          <span className="text-xs whitespace-normal text-muted-foreground">{areas}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 gap-3">
        {groups.map((group) => (
          <div key={group.area} className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">{group.area}</p>
            <div className="flex flex-wrap gap-1">
              {group.scopes.map((scope) => (
                <ScopeBadge key={scope} scope={scope} />
              ))}
            </div>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  )
}
