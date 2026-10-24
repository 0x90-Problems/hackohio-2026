"use client"

import { useId, useState } from "react"
import { XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

// Edits a list of tags. Type a tag and press Enter (or a comma) to add it;
// click the x on a tag to remove it. Existing tags are offered as suggestions.
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
  const [text, setText] = useState("")
  const listId = useId()

  function add(raw: string) {
    const tag = raw.trim()
    setText("")
    if (!tag || tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return
    onChange([...tags, tag])
  }

  return (
    <div className="flex flex-col gap-2">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="pr-1 font-normal">
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
          ))}
        </div>
      )}
      <Input
        id={id}
        value={text}
        list={listId}
        placeholder="Add a tag and press Enter"
        onChange={(e) => {
          // Typing a comma adds the tag right away
          const value = e.target.value
          if (value.endsWith(",")) add(value.slice(0, -1))
          else setText(value)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            add(text)
          } else if (e.key === "Backspace" && !text && tags.length) {
            onChange(tags.slice(0, -1))
          }
        }}
        onBlur={() => text && add(text)}
      />
      <datalist id={listId}>
        {suggestions
          .filter((s) => !tags.includes(s))
          .map((s) => (
            <option key={s} value={s} />
          ))}
      </datalist>
    </div>
  )
}
