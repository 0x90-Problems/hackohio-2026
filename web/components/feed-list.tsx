"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { FeedPager } from "@/components/feed-pager"
import { Skeleton } from "@/components/ui/skeleton"

export type FeedItem = { id: string; isNew?: boolean }

// A paginated list for the home feeds.
// - While loading: Skeleton rows.
// - Switching pages: the list fades in.
// - Items marked isNew (arrived live): slide in from the top and fade in.
export function FeedList<T extends FeedItem>({
  items,
  pageSize,
  loading,
  renderItem,
}: {
  items: T[]
  pageSize: number
  loading: boolean
  renderItem: (item: T) => React.ReactNode
}) {
  const [page, setPage] = useState(1)
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const current = Math.min(page, pageCount)
  const visible = items.slice((current - 1) * pageSize, current * pageSize)

  if (loading) {
    return (
      <div className="flex flex-col divide-y">
        {Array.from({ length: pageSize }, (_, i) => (
          <div key={i} className="flex flex-col gap-2 py-3">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return <p className="py-6 text-sm text-muted-foreground">No activity yet.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {/* key={current} remounts the list on page change, which replays the fade */}
      <ul key={current} className="flex flex-col divide-y duration-200 animate-in fade-in">
        {visible.map((item) => (
          <li
            key={item.id}
            className={cn(
              item.isNew && "duration-300 animate-in fade-in slide-in-from-top-2"
            )}
          >
            {renderItem(item)}
          </li>
        ))}
      </ul>
      {pageCount > 1 && (
        <FeedPager page={current} pageCount={pageCount} onPageChange={setPage} />
      )}
    </div>
  )
}
