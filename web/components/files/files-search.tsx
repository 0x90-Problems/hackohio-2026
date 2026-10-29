"use client"

import { useEffect, useState } from "react"

import { FileIcon, FileTextIcon, FolderIcon } from "@/components/icons"
import { SearchCombobox } from "@/components/search-combobox"
import { type Folder, foldersApi } from "@/lib/folders-api"

type Hit = Folder & { path?: string[] }

// Search the team's folders, files and notes by name (results come from the server,
// already filtered to what you can see).
export function FilesSearch({ onPick }: { onPick: (hit: Hit) => void }) {
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<Hit[]>([])

  useEffect(() => {
    const text = query.trim()
    if (text.length < 2) return
    let cancelled = false
    // Wait for a pause in typing before asking the server.
    const timer = setTimeout(() => {
      foldersApi
        .search(text)
        .then((result) => !cancelled && setHits(result.items))
        .catch(() => !cancelled && setHits([]))
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  const shown = query.trim().length < 2 ? [] : hits

  return (
    <SearchCombobox
      label="Search files"
      searchPlaceholder="Search by name…"
      emptyText={query.trim().length < 2 ? "Type at least 2 characters." : "Nothing found."}
      filter={false}
      onQueryChange={setQuery}
      groups={[
        {
          items: shown.map((hit) => {
            const Icon = hit.type === "note" ? FileTextIcon : hit.type === "file" ? FileIcon : FolderIcon
            return {
              value: hit.id,
              label: (
                <span className="flex min-w-0 items-center gap-2">
                  <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{hit.name}</span>
                    {hit.path && hit.path.length > 0 && (
                      <span className="truncate text-xs text-muted-foreground">{hit.path.join(" / ")}</span>
                    )}
                  </span>
                </span>
              ),
              onSelect: () => onPick(hit),
            }
          }),
        },
      ]}
    />
  )
}
