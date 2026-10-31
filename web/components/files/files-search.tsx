"use client"

import { useEffect, useState } from "react"

import { NodeIcon } from "@/components/files/thumbnail"
import { SearchCombobox } from "@/components/search-combobox"
import { type Folder, foldersApi } from "@/lib/folders-api"

type Hit = Folder & { path?: string[] }

// Search the team's folders, files and notes by name, or just one type of them (results
// come from the server, already filtered to what you can see).
export function FilesSearch({ onPick, type, label = "Search files" }: { onPick: (hit: Hit) => void; type?: Folder["type"]; label?: string }) {
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<Hit[]>([])

  useEffect(() => {
    const text = query.trim()
    if (text.length < 2) return
    let cancelled = false
    // Wait for a pause in typing before asking the server.
    const timer = setTimeout(() => {
      foldersApi
        .search(text, type)
        .then((result) => !cancelled && setHits(result.items))
        .catch(() => !cancelled && setHits([]))
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, type])

  const shown = query.trim().length < 2 ? [] : hits

  return (
    <SearchCombobox
      label={label}
      searchPlaceholder="Search by name…"
      emptyText={query.trim().length < 2 ? "Type at least 2 characters." : "Nothing found."}
      filter={false}
      onQueryChange={setQuery}
      groups={[
        {
          items: shown.map((hit) => {
            return {
              value: hit.id,
              label: (
                <span className="flex min-w-0 items-center gap-2">
                  <NodeIcon node={hit} />
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
