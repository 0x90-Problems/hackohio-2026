"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { PlusIcon, TagIcon, XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

// Edits a list of tags with the team's combo search box: "Add tag" opens a
// search over the tags this project already uses, or creates a new one.
// Click the x on a tag to remove it.
export function TagInput({
  id,
  tags,
  onChange,
  suggestions = [],
}: {
  id?: string
  tags: string[]
  onChange: (tags: string[]) => void
  suggestions?: string[]
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const typed = search.trim()
  const options = suggestions.filter((s) => !tags.includes(s))
  const exists = [...tags, ...suggestions].some(
    (t) => t.toLowerCase() === typed.toLowerCase()
  )

  function add(tag: string) {
    if (!tags.some((t) => t.toLowerCase() === tag.toLowerCase()))
      onChange([...tags, tag])
    setSearch("")
    setOpen(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* Tags pop in when added and shrink away when removed */}
      <AnimatePresence initial={false} mode="popLayout">
        {tags.map((tag) => (
          <motion.span
            key={tag}
            layout
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          >
            <Badge variant="secondary" className="pr-1 font-normal">
              {tag}
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-foreground/10"
                aria-label={`Remove tag ${tag}`}
                onClick={() => onChange(tags.filter((t) => t !== tag))}
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          </motion.span>
        ))}
      </AnimatePresence>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setSearch("")
        }}
      >
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            size="xs"
            role="combobox"
            aria-expanded={open}
            className="border-dashed font-normal text-muted-foreground"
          >
            <PlusIcon />
            Add tag
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-60 p-0">
          <Command>
            <CommandInput
              placeholder="Search or create a tag"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {(!typed || exists) && (
                <CommandEmpty>
                  {typed ? "No matching tags." : "No tags yet. Type one."}
                </CommandEmpty>
              )}
              {options.length > 0 && (
                <CommandGroup heading="Tags in this project">
                  {options.map((tag) => (
                    <CommandItem
                      key={tag}
                      value={tag}
                      onSelect={() => add(tag)}
                    >
                      <TagIcon />
                      {tag}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {typed && !exists && (
                <CommandGroup heading="New tag" forceMount>
                  {/* forceMount keeps "Create" visible even though it doesn't match the filter */}
                  <CommandItem
                    value={`create ${typed}`}
                    forceMount
                    onSelect={() => add(typed)}
                  >
                    <PlusIcon />
                    Create “{typed}”
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
