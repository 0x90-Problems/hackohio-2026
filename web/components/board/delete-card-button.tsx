"use client"

import { Trash2Icon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Independent of approval controls. Mount this on every card, including a bot's only card.
// Closed cards show the icon only. The open ticket passes labeled so the word Delete stays.
export function DeleteCardButton({
  ticketKey,
  onDelete,
  labeled = false,
  className,
}: {
  ticketKey: string
  onDelete: (ticketKey: string) => void
  labeled?: boolean
  className?: string
}) {
  return (
    <Button
      type="button"
      variant="destructive"
      size={labeled ? "sm" : "icon-xs"}
      aria-label={labeled ? undefined : `Delete ${ticketKey}`}
      className={cn(labeled ? "h-7 px-2 text-xs" : "size-7", className)}
      onMouseDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        if (window.confirm(`Delete ${ticketKey}? Only this card is removed.`)) onDelete(ticketKey)
      }}
    >
      <Trash2Icon aria-hidden="true" />
      {labeled ? "Delete" : null}
    </Button>
  )
}
