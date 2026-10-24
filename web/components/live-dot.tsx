import { cn } from "@/lib/utils"

// Small pulsing dot + label for live feeds ("Live", "Streaming").
export function LiveDot({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-foreground/40" />
        <span className="relative inline-flex size-2 rounded-full bg-foreground" />
      </span>
      {label}
    </span>
  )
}
