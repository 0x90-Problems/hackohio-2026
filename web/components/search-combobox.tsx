"use client"

import { useState } from "react"
import { SearchIcon } from "@/components/icons"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export type SearchItem = {
  // Unique id for the item
  value: string
  // Extra words the search should match (ids, tags ...)
  keywords?: string[]
  // What the row shows
  label: React.ReactNode
  onSelect: () => void
}

export type SearchGroup = { heading?: string; items: SearchItem[] }

// The team's "combo search box": a button that opens a popover with a search
// field and a grouped, filtered list (shadcn Combobox = Popover + Command).
// Pass `trigger` to use your own button, e.g. a page title.
export function SearchCombobox({
  label,
  searchPlaceholder = "Search…",
  emptyText = "No results.",
  groups,
  trigger,
  className,
  align = "start",
  onQueryChange,
  filter = true,
}: {
  label: string
  searchPlaceholder?: string
  emptyText?: string
  groups: SearchGroup[]
  trigger?: React.ReactNode
  className?: string
  align?: "start" | "center" | "end"
  // For results that come from a server: called as the user types; turn off local filtering.
  onQueryChange?: (query: string) => void
  filter?: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-64 justify-start gap-2 font-normal text-muted-foreground",
              className
            )}
          >
            <SearchIcon aria-hidden="true" />
            {label}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align={align} className="w-80 p-0">
        <Command shouldFilter={filter}>
          <CommandInput placeholder={searchPlaceholder} onValueChange={onQueryChange} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {groups.map((group, i) =>
              group.items.length === 0 ? null : (
                <div key={group.heading ?? i}>
                  {i > 0 && <CommandSeparator />}
                  <CommandGroup heading={group.heading}>
                    {group.items.map((item) => (
                      <CommandItem
                        key={item.value}
                        value={item.value}
                        keywords={item.keywords}
                        onSelect={() => {
                          setOpen(false)
                          item.onSelect()
                        }}
                      >
                        {item.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </div>
              )
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
