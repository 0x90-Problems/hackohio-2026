"use client"

import { useEffect, useRef, useState } from "react"

import { SearchIcon } from "@/components/icons"
import { SearchCombobox } from "@/components/search-combobox"
import { Button } from "@/components/ui/button"
import { type ChatMessage, ChatError, chatApi } from "@/lib/chat-api"
import { absoluteTime, timeAgo } from "@/lib/format"

const MIN_QUERY = 2
const SNIPPET = 90

type Found = { query: string; results: ChatMessage[]; next: string | null; backTo: string | null; error: string }

// Part of the text around the first match, with the match picked out. Text only: a message
// body is untrusted and is never treated as markup.
function Snippet({ text, query }: { text: string; query: string }) {
  const at = text.toLowerCase().indexOf(query.trim().toLowerCase())
  if (at < 0) return <>{text.slice(0, SNIPPET)}</>
  const start = Math.max(0, at - 30)
  const end = at + query.trim().length
  return (
    <>
      {start > 0 ? "…" : ""}
      {text.slice(start, at)}
      <mark className="rounded-sm bg-muted px-0.5 font-semibold text-foreground">{text.slice(at, end)}</mark>
      {text.slice(end, start + SNIPPET)}
      {text.length > start + SNIPPET ? "…" : ""}
    </>
  )
}

/** Search this channel's messages and thread replies. Picking one opens its thread. */
export function ChannelSearch({ channelId, channelName, onOpen }: { channelId: string; channelName: string; onOpen: (rootId: string) => void }) {
  const [query, setQuery] = useState("")
  const [found, setFound] = useState<Found | null>(null)
  const latest = useRef("")
  const text = query.trim()

  useEffect(() => {
    latest.current = text
    if (text.length < MIN_QUERY) return
    // Wait for a pause in typing before asking the server.
    const timer = setTimeout(() => {
      chatApi
        .search(channelId, text)
        .then((page) => {
          if (latest.current === text) setFound({ query: text, results: page.results, next: page.next_before, backTo: page.searched_back_to, error: "" })
        })
        .catch((caught) => {
          if (latest.current === text) setFound({ query: text, results: [], next: null, backTo: null, error: caught instanceof ChatError ? caught.message : "Couldn't search right now." })
        })
    }, 300)
    return () => clearTimeout(timer)
  }, [text, channelId])

  const older = async () => {
    if (!found?.next) return
    const { query: asked, next } = found
    try {
      const page = await chatApi.search(channelId, asked, next)
      if (latest.current !== asked) return
      setFound((current) =>
        current && current.query === asked
          ? { query: asked, results: [...current.results, ...page.results], next: page.next_before, backTo: page.searched_back_to ?? current.backTo, error: "" }
          : current
      )
    } catch (caught) {
      if (latest.current === asked) setFound((current) => (current ? { ...current, next: null, error: caught instanceof ChatError ? caught.message : "Couldn't search right now." } : current))
    }
  }

  const shown = found && found.query === text ? found : null
  const empty =
    text.length < MIN_QUERY ? `Type at least ${MIN_QUERY} characters.` : !shown ? "Searching…" : shown.error || "No messages found."

  return (
    <SearchCombobox
      label={`Search #${channelName}`}
      searchPlaceholder={`Search ${channelName}…`}
      emptyText={empty}
      filter={false}
      align="end"
      onQueryChange={setQuery}
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Search ${channelName}`}>
          <SearchIcon aria-hidden="true" />
        </Button>
      }
      groups={[
        {
          items: (shown?.results ?? []).map((message) => {
            const created = new Date(message.created_at)
            return {
              value: message.id,
              onSelect: () => onOpen(message.thread_root_id || message.id),
              label: (
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="truncate font-medium text-foreground">{message.author.name ?? message.author.id}</span>
                    <time dateTime={message.created_at} title={absoluteTime(created)}>
                      {timeAgo(created)}
                    </time>
                    {message.thread_root_id ? <span>in a thread</span> : null}
                  </span>
                  <span className="line-clamp-2 text-sm break-words">
                    <Snippet text={message.body} query={shown?.query ?? ""} />
                  </span>
                </span>
              ),
            }
          }),
        },
        {
          items:
            shown?.next && !shown.error
              ? [
                  {
                    value: "search-older",
                    keepOpen: true,
                    onSelect: () => void older(),
                    label: (
                      <span className="text-xs">
                        Search older messages{shown.backTo ? ` (searched back to ${new Date(shown.backTo).toLocaleDateString()})` : ""}
                      </span>
                    ),
                  },
                ]
              : [],
        },
      ]}
    />
  )
}
