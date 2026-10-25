import { PRODUCT_NAME } from "@/lib/brand"
import { cn } from "@/lib/utils"

export function Logo({
  className,
  markClassName,
}: {
  className?: string
  markClassName?: string
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold", className)}>
      {/* The mark is the same file the browser tab uses. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-mark.png" alt="" className={cn("size-6", markClassName)} />
      {PRODUCT_NAME}
    </span>
  )
}
