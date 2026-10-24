import type { Scope } from "@/shared/names"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

// A token scope like tickets:write, shown in monospace.
export function ScopeBadge({
  scope,
  className,
}: {
  scope: Scope
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn("rounded-sm font-mono font-normal", className)}
    >
      {scope}
    </Badge>
  )
}
