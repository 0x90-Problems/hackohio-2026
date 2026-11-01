"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { ActorBadge, AgentTag, HumanAvatar } from "@/components/actor-badge"
import { useAuthUser } from "@/components/auth/auth-gate"
import {
  ArchiveIcon,
  ChevronLeftIcon,
  LockIcon,
  MessageCircleIcon,
  MessagesSquareIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  ShieldOffIcon,
  Trash2Icon,
  UserPlusIcon,
  XIcon,
} from "@/components/icons"
import { TeamSwitcher } from "@/components/team-switcher"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  type Channel,
  type ChatMessage,
  type ChatPerson,
  type ChatWorkspace,
  ChatError,
  chatApi,
  isUnread,
  principalOf,
} from "@/lib/chat-api"
import { absoluteTime, timeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"

// Until live updates (C2), the open channel and thread refresh by polling:
// often while the tab is visible, rarely while it's hidden.
const POLL_VISIBLE_MS = 5_000
const POLL_HIDDEN_MS = 60_000
const PAGE = 50

function explain(error: unknown) {
  if (error instanceof ChatError) return error.message
  return "Something went wrong. Try again."
}

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
}

function usePoll(run: () => void, deps: unknown[]) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    let stopped = false
    const tick = () => {
      if (stopped) return
      run()
      timer = setTimeout(tick, document.visibilityState === "visible" ? POLL_VISIBLE_MS : POLL_HIDDEN_MS)
    }
    timer = setTimeout(tick, 0) // the first load, then every few seconds
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(timer)
        tick()
      }
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      stopped = true
      clearTimeout(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

function channelLabel(channel: Channel) {
  return channel.kind === "text" ? channel.name : channel.name || "Direct message"
}

function ChannelGlyph({ channel, className }: { channel: Channel; className?: string }) {
  if (channel.kind !== "text") return <MessageCircleIcon className={cn("size-4 shrink-0", className)} aria-hidden="true" />
  if (channel.visibility === "private") return <LockIcon className={cn("size-3.5 shrink-0", className)} aria-hidden="true" />
  return <span className={cn("w-4 shrink-0 text-center text-muted-foreground", className)} aria-hidden="true">#</span>
}

// ---------------------------------------------------------------------------

export function ChatView() {
  const router = useRouter()
  const params = useSearchParams()
  const selectedId = params.get("c")
  const threadId = params.get("t")
  const [ws, setWs] = useState<ChatWorkspace | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "off" | "error">("loading")
  const [error, setError] = useState("")
  const [dialog, setDialog] = useState<null | "channel" | "dm" | "browse" | "section">(null)

  const go = useCallback(
    (channel: string | null, thread: string | null = null) => {
      const next = new URLSearchParams()
      if (channel) next.set("c", channel)
      if (thread) next.set("t", thread)
      router.replace(`/chat${next.size ? `?${next}` : ""}`, { scroll: false })
    },
    [router]
  )

  const refresh = useCallback(async () => {
    try {
      setWs(await chatApi.workspace())
      setState("ready")
    } catch (caught) {
      if (caught instanceof ChatError && caught.code === "feature_disabled") setState("off")
      else {
        setError(explain(caught))
        setState((current) => (current === "ready" ? current : "error"))
      }
    }
  }, [])

  usePoll(() => void refresh(), [refresh])

  const selected = useMemo(
    () => ws?.channels.find((c) => c.id === selectedId) ?? ws?.joinable.find((c) => c.id === selectedId) ?? null,
    [ws, selectedId]
  )
  const directory = useMemo(() => {
    const map = new Map<string, ChatPerson>()
    for (const person of [...(ws?.people ?? []), ...(ws?.agents ?? [])]) map.set(person.id, person)
    return map
  }, [ws])

  if (state === "loading") return <ChatSkeleton />
  if (state === "off") {
    return (
      <EmptyState title="Chat isn't turned on yet" body="An admin can turn it on once it's ready for your team." />
    )
  }
  if (state === "error" || !ws) return <EmptyState title="Couldn't open chat" body={error} action={<Button onClick={() => void refresh()}>Try again</Button>} />

  return (
    <div className="mx-auto flex h-[calc(100svh-3.5rem)] max-w-screen-2xl">
      <Sidebar
        ws={ws}
        selectedId={selectedId}
        onSelect={(id) => go(id)}
        onDialog={setDialog}
        className={cn(selectedId ? "hidden md:flex" : "flex")}
      />
      <main className={cn("min-w-0 flex-1 flex-col", selectedId ? "flex" : "hidden md:flex")}>
        {selected ? (
          <ChannelPane
            key={selected.id}
            ws={ws}
            channel={selected}
            directory={directory}
            threadId={threadId}
            onBack={() => go(null)}
            onThread={(root) => go(selected.id, root)}
            onChanged={refresh}
            onLeft={() => {
              go(null)
              void refresh()
            }}
          />
        ) : (
          <EmptyState
            title={`Chat for ${ws.team}`}
            body="Pick a channel on the left, or start a conversation."
            action={
              <Button onClick={() => setDialog("channel")}>
                <PlusIcon aria-hidden="true" /> New channel
              </Button>
            }
          />
        )}
      </main>
      {selected && threadId ? (
        <ThreadPane
          key={`${selected.id}:${threadId}`}
          channel={selected}
          canModerate={ws.is_owner || selected.role === "manager"}
          rootId={threadId}
          directory={directory}
          onClose={() => go(selected.id)}
        />
      ) : null}

      <NewChannelDialog
        key={dialog === "channel" ? "open" : "closed"}
        open={dialog === "channel"}
        ws={ws}
        onClose={() => setDialog(null)}
        onCreated={(channel) => {
          setDialog(null)
          void refresh().then(() => go(channel.id))
        }}
      />
      <NewDmDialog
        key={dialog === "dm" ? "open" : "closed"}
        open={dialog === "dm"}
        ws={ws}
        onClose={() => setDialog(null)}
        onOpened={(channel) => {
          setDialog(null)
          void refresh().then(() => go(channel.id))
        }}
      />
      <BrowseDialog
        key={dialog === "browse" ? "open" : "closed"}
        open={dialog === "browse"}
        channels={ws.joinable}
        onClose={() => setDialog(null)}
        onOpen={(id) => {
          setDialog(null)
          go(id)
        }}
      />
      <SectionDialog key={dialog === "section" ? "open" : "closed"} open={dialog === "section"} onClose={() => setDialog(null)} onSaved={() => void refresh()} />
    </div>
  )
}

// -- sidebar ------------------------------------------------------------------

function Sidebar({
  ws,
  selectedId,
  onSelect,
  onDialog,
  className,
}: {
  ws: ChatWorkspace
  selectedId: string | null
  onSelect: (id: string) => void
  onDialog: (kind: "channel" | "dm" | "browse" | "section") => void
  className?: string
}) {
  const text = ws.channels.filter((c) => c.kind === "text")
  const dms = ws.channels.filter((c) => c.kind !== "text")
  const sectionIds = new Set(ws.sections.map((s) => s.id))
  const loose = text.filter((c) => !c.section_id || !sectionIds.has(c.section_id))

  return (
    <aside aria-label="Channels" className={cn("w-full shrink-0 flex-col border-r bg-muted/30 md:w-64", className)}>
      <div className="flex h-12 items-center justify-between gap-2 border-b px-3">
        <TeamSwitcher className="min-w-0 flex-1" fallback={<h1 className="truncate text-sm font-semibold">{ws.team}</h1>} />
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon-sm" aria-label="Browse channels" onClick={() => onDialog("browse")}>
            <SearchIcon aria-hidden="true" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="New">
                <PlusIcon aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onDialog("channel")}>New channel</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onDialog("dm")}>New direct message</DropdownMenuItem>
              {ws.is_owner ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => onDialog("section")}>New section</DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {ws.agents_paused ? (
        <p className="border-b bg-muted px-3 py-2 text-xs text-muted-foreground">Agents are paused across the workspace.</p>
      ) : null}
      <nav className="flex-1 overflow-y-auto p-2">
        {ws.sections.map((section) => (
          <ChannelGroup
            key={section.id}
            title={section.name}
            channels={text.filter((c) => c.section_id === section.id)}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
        <ChannelGroup title="Channels" channels={loose} selectedId={selectedId} onSelect={onSelect} empty="No channels yet" />
        <ChannelGroup title="Direct messages" channels={dms} selectedId={selectedId} onSelect={onSelect} empty="No conversations yet" />
      </nav>
    </aside>
  )
}

function ChannelGroup({
  title,
  channels,
  selectedId,
  onSelect,
  empty,
}: {
  title: string
  channels: Channel[]
  selectedId: string | null
  onSelect: (id: string) => void
  empty?: string
}) {
  if (!channels.length && !empty) return null
  return (
    <section className="mb-3">
      <h2 className="px-2 pb-1 text-xs font-medium text-muted-foreground">{title}</h2>
      {channels.length ? (
        <ul>
          {channels.map((channel) => {
            const unread = isUnread(channel) && channel.id !== selectedId
            return (
              <li key={channel.id}>
                <button
                  type="button"
                  onClick={() => onSelect(channel.id)}
                  aria-current={channel.id === selectedId ? "page" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                    channel.id === selectedId && "bg-muted font-medium",
                    unread && "font-semibold"
                  )}
                >
                  <ChannelGlyph channel={channel} />
                  <span className="truncate">{channelLabel(channel)}</span>
                  {unread ? <span className="ml-auto size-2 shrink-0 rounded-full bg-foreground" aria-label="unread" /> : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="px-2 text-xs text-muted-foreground">{empty}</p>
      )}
    </section>
  )
}

// -- channel ------------------------------------------------------------------

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map(current.map((m) => [m.id, m]))
  for (const message of incoming) byId.set(message.id, message)
  return [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : 1))
}

function ChannelPane({
  ws,
  channel,
  directory,
  threadId,
  onBack,
  onThread,
  onChanged,
  onLeft,
}: {
  ws: ChatWorkspace
  channel: Channel
  directory: Map<string, ChatPerson>
  threadId: string | null
  onBack: () => void
  onThread: (rootId: string) => void
  onChanged: () => Promise<void>
  onLeft: () => void
}) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null)
  const [more, setMore] = useState(false)
  const [error, setError] = useState("")
  const [manage, setManage] = useState<null | "people" | "edit" | "archive">(null)
  const listRef = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)
  const member = Boolean(channel.role)
  const canManage = ws.is_owner || channel.role === "manager"
  const lastRead = useRef(channel.last_read_msg_id ?? "")

  const scrollToEnd = () => {
    const el = listRef.current
    if (el && pinned.current) el.scrollTop = el.scrollHeight
  }

  // Reads the newest page each time (not just what's after the last id), so
  // edits, reply counts and hides on recent messages show up too.
  const loaded = useRef(false)
  const load = useCallback(async () => {
    try {
      const page = await chatApi.messages(channel.id, { limit: PAGE })
      setMessages((now) => (now ? mergeMessages(now, page.messages) : page.messages))
      if (!loaded.current) setMore(page.more)
      loaded.current = true
      setError("")
    } catch (caught) {
      // keep what's on screen; the next poll retries
      if (!loaded.current) setError(explain(caught))
    }
  }, [channel.id])
  usePoll(() => void load(), [load])

  useEffect(scrollToEnd, [messages])

  // Mark read up to the newest message I can see.
  useEffect(() => {
    const newest = messages?.at(-1)?.id
    if (!member || !newest || newest <= lastRead.current) return
    lastRead.current = newest
    void chatApi.markRead(channel.id, newest).catch(() => undefined)
  }, [messages, member, channel.id])

  const loadOlder = async () => {
    const first = messages?.[0]?.id
    if (!first) return
    const el = listRef.current
    const before = el?.scrollHeight ?? 0
    try {
      const page = await chatApi.messages(channel.id, { before: first, limit: PAGE })
      pinned.current = false
      setMessages((current) => mergeMessages(current ?? [], page.messages))
      setMore(page.more)
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - before
      })
    } catch (caught) {
      toast.error(explain(caught))
    }
  }

  const act = async (run: () => Promise<unknown>, done?: string) => {
    try {
      await run()
      if (done) toast.success(done)
      await onChanged()
    } catch (caught) {
      toast.error(explain(caught))
    }
  }

  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="Back to channels" onClick={onBack}>
          <ChevronLeftIcon aria-hidden="true" />
        </Button>
        <ChannelGlyph channel={channel} />
        <h2 className="truncate text-sm font-semibold">{channelLabel(channel)}</h2>
        {channel.topic ? <p className="hidden truncate text-sm text-muted-foreground lg:block">{channel.topic}</p> : null}
        {channel.paused ? (
          <Badge variant="outline" className="shrink-0">
            <ShieldOffIcon aria-hidden="true" /> Agents paused
          </Badge>
        ) : null}
        <div className="ml-auto flex items-center gap-1">
          {member ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Channel options">
                  <MoreHorizontalIcon aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {channel.kind === "text" ? (
                  <DropdownMenuItem onSelect={() => setManage("people")}>
                    <UserPlusIcon aria-hidden="true" /> Add people or agents
                  </DropdownMenuItem>
                ) : null}
                {canManage && channel.kind === "text" ? (
                  <DropdownMenuItem onSelect={() => setManage("edit")}>
                    <PencilIcon aria-hidden="true" /> Rename or change topic
                  </DropdownMenuItem>
                ) : null}
                {canManage ? (
                  <DropdownMenuItem
                    onSelect={() =>
                      void act(
                        () => chatApi.setPaused(channel.id, !channel.paused),
                        channel.paused ? "Agents can post again" : "Agents are paused in this channel"
                      )
                    }
                  >
                    <ShieldOffIcon aria-hidden="true" /> {channel.paused ? "Resume agents" : "Pause agents"}
                  </DropdownMenuItem>
                ) : null}
                {channel.kind !== "dm" ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => void act(() => chatApi.leave(channel.id)).then(onLeft)}>Leave</DropdownMenuItem>
                  </>
                ) : null}
                {canManage && channel.kind === "text" ? (
                  <DropdownMenuItem variant="destructive" onSelect={() => setManage("archive")}>
                    <ArchiveIcon aria-hidden="true" /> Archive channel
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </header>

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto"
        onScroll={(event) => {
          const el = event.currentTarget
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
        }}
      >
        {messages === null ? (
          error ? (
            <p className="p-6 text-sm text-muted-foreground">{error}</p>
          ) : (
            <MessagesSkeleton />
          )
        ) : (
          <div className="flex min-h-full flex-col justify-end py-3" role="log" aria-live="polite" aria-label={`Messages in ${channelLabel(channel)}`}>
            {more ? (
              <div className="flex justify-center pb-2">
                <Button variant="ghost" size="sm" onClick={() => void loadOlder()}>
                  Load older messages
                </Button>
              </div>
            ) : (
              <p className="px-4 pb-4 text-sm text-muted-foreground">
                This is the start of {channel.kind === "text" ? `#${channel.name}` : "your conversation"}.
              </p>
            )}
            {messages.map((message) => (
              <MessageRow
                key={message.id}
                message={message}
                directory={directory}
                canModerate={canManage}
                active={message.id === threadId}
                onThread={() => onThread(message.id)}
                onChanged={(next) => setMessages((current) => mergeMessages(current ?? [], [next]))}
              />
            ))}
          </div>
        )}
      </div>

      {member ? (
        <Composer
          channel={channel}
          directory={directory}
          placeholder={`Message ${channel.kind === "text" ? `#${channel.name}` : channelLabel(channel)}`}
          onSent={(message) => {
            pinned.current = true
            setMessages((current) => mergeMessages(current ?? [], [message]))
          }}
        />
      ) : (
        <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
          <p className="text-sm text-muted-foreground">You&apos;re viewing #{channel.name}.</p>
          <Button onClick={() => void act(() => chatApi.join(channel.id), `Joined #${channel.name}`)}>Join channel</Button>
        </div>
      )}

      <AddPeopleDialog key={manage === "people" ? "open" : "closed"} open={manage === "people"} ws={ws} channel={channel} onClose={() => setManage(null)} />
      <EditChannelDialog
        key={manage === "edit" ? "open" : "closed"}
        open={manage === "edit"}
        channel={channel}
        onClose={() => setManage(null)}
        onSaved={() => {
          setManage(null)
          void onChanged()
        }}
      />
      <Dialog open={manage === "archive"} onOpenChange={(open) => !open && setManage(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive #{channel.name}?</DialogTitle>
            <DialogDescription>
              No one can post in it after this. Its messages are kept, and the name becomes free for a new channel.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManage(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setManage(null)
                void act(() => chatApi.archive(channel.id), `Archived #${channel.name}`).then(onLeft)
              }}
            >
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// -- messages -------------------------------------------------------------------

const MENTION = /@((?:agent|user)_[A-Za-z0-9_-]+)/g

function MessageBody({ text, directory }: { text: string; directory: Map<string, ChatPerson> }) {
  const parts: React.ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(MENTION)) {
    const index = match.index ?? 0
    if (index > last) parts.push(text.slice(last, index))
    const person = directory.get(match[1])
    parts.push(
      <span key={index} className="rounded bg-muted px-1 font-medium">
        @{person?.name ?? match[1]}
      </span>
    )
    last = index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <p className="text-sm break-words whitespace-pre-wrap">{parts}</p>
}

function MessageRow({
  message,
  directory,
  canModerate,
  active,
  inThread = false,
  onThread,
  onChanged,
}: {
  message: ChatMessage
  directory: Map<string, ChatPerson>
  canModerate: boolean
  active?: boolean
  inThread?: boolean
  onThread?: () => void
  onChanged: (message: ChatMessage) => void
}) {
  const me = useAuthUser()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(message.body)
  const own = message.author.type !== "agent" && message.author.id === me?._id
  const created = new Date(message.created_at)

  const save = async () => {
    try {
      const out = await chatApi.edit(message.channel_id, message.id, draft)
      onChanged(out.message)
      setEditing(false)
    } catch (caught) {
      toast.error(explain(caught))
    }
  }

  let body: React.ReactNode
  if (message.deleted_at) body = <p className="text-sm text-muted-foreground italic">This message was deleted.</p>
  else if (message.hidden && !message.body) body = <p className="text-sm text-muted-foreground italic">Hidden by a moderator.</p>
  else if (message.type !== "text" && message.type !== "system") body = <p className="text-sm text-muted-foreground italic">Unsupported message.</p>
  else if (editing)
    body = (
      <div className="flex flex-col gap-2">
        <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Edit message" className="min-h-16" />
        <div className="flex gap-2">
          <Button size="sm" onClick={() => void save()} disabled={!draft.trim()}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </div>
    )
  else body = <MessageBody text={message.body} directory={directory} />

  return (
    <article
      className={cn(
        "group relative flex flex-col gap-1 px-4 py-2 hover:bg-muted/40",
        active && "bg-muted/60",
        message.from === "human_instruction" && "border-l-2 border-foreground/40 bg-muted/30"
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <ActorBadge actor={message.author} />
        <time className="shrink-0 text-xs text-muted-foreground" dateTime={message.created_at} title={absoluteTime(created)}>
          {timeAgo(created)}
        </time>
        {message.edited_at && !message.deleted_at ? <span className="text-xs text-muted-foreground">(edited)</span> : null}
        {message.from === "human_instruction" ? (
          <Badge variant="outline" className="text-xs">
            Instruction for agents
          </Badge>
        ) : null}
        {message.hidden && message.body ? (
          <Badge variant="outline" className="text-xs" title={message.hidden_reason}>
            Hidden
          </Badge>
        ) : null}
      </div>
      {body}
      {!inThread && message.reply_count ? (
        <button type="button" onClick={onThread} className="self-start text-xs font-medium hover:underline">
          {message.reply_count} {message.reply_count === 1 ? "reply" : "replies"}
        </button>
      ) : null}
      {!message.deleted_at && !editing ? (
        <div className="absolute top-1 right-3 hidden items-center gap-0.5 rounded-md border bg-background shadow-sm group-focus-within:flex group-hover:flex">
          {!inThread && onThread ? (
            <Button variant="ghost" size="icon-xs" aria-label="Reply in thread" onClick={onThread}>
              <MessageCircleIcon aria-hidden="true" />
            </Button>
          ) : null}
          {own ? (
            <Button variant="ghost" size="icon-xs" aria-label="Edit message" onClick={() => setEditing(true)}>
              <PencilIcon aria-hidden="true" />
            </Button>
          ) : null}
          {own ? (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Delete message"
              onClick={() =>
                void chatApi
                  .remove(message.channel_id, message.id)
                  .then((out) => onChanged(out.message))
                  .catch((caught) => toast.error(explain(caught)))
              }
            >
              <Trash2Icon aria-hidden="true" />
            </Button>
          ) : null}
          {canModerate && !own && !message.hidden ? (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Hide message"
              onClick={() =>
                void chatApi
                  .hide(message.channel_id, message.id, "")
                  .then(() => onChanged({ ...message, hidden: true }))
                  .catch((caught) => toast.error(explain(caught)))
              }
            >
              <ShieldOffIcon aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

// -- composer ------------------------------------------------------------------

function Composer({
  channel,
  directory,
  threadRootId,
  placeholder,
  onSent,
}: {
  channel: Channel
  directory: Map<string, ChatPerson>
  threadRootId?: string
  placeholder: string
  onSent: (message: ChatMessage) => void
}) {
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [instruction, setInstruction] = useState(false)
  const [query, setQuery] = useState<string | null>(null)
  const [highlight, setHighlight] = useState(0)
  const key = useRef(newKey())
  const box = useRef<HTMLTextAreaElement>(null)

  // @ autocomplete: people and agents on the team. Inserted as @<id>; shown as names.
  const matches = useMemo(() => {
    if (query === null) return []
    const q = query.toLowerCase()
    return [...directory.values()].filter((p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)).slice(0, 6)
  }, [query, directory])

  const updateQuery = (value: string, caret: number) => {
    const before = value.slice(0, caret)
    const match = /(?:^|\s)@([\w-]*)$/.exec(before)
    setQuery(match ? match[1] : null)
    setHighlight(0)
  }

  const pick = (person: ChatPerson) => {
    const el = box.current
    const caret = el?.selectionStart ?? text.length
    const before = text.slice(0, caret).replace(/@([\w-]*)$/, `@${person.id} `)
    const next = before + text.slice(caret)
    setText(next)
    setQuery(null)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(before.length, before.length)
    })
  }

  const send = async () => {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    try {
      const out = await chatApi.post(channel.id, body, { threadRootId, idempotencyKey: key.current, instruction })
      onSent(out.message)
      setText("")
      setInstruction(false)
      key.current = newKey()
    } catch (caught) {
      // Keep the text and the key: retrying can never post twice.
      toast.error(explain(caught))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="relative shrink-0 border-t p-3">
      {matches.length ? (
        <ul role="listbox" aria-label="Mention someone" className="absolute bottom-full left-3 mb-1 w-72 overflow-hidden rounded-md border bg-popover p-1 shadow-md">
          {matches.map((person, index) => (
            <li key={person.id} role="option" aria-selected={index === highlight}>
              <button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault()
                  pick(person)
                }}
                className={cn("flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm", index === highlight && "bg-muted")}
              >
                {person.type === "agent" ? <AgentTag /> : <HumanAvatar name={person.name} />}
                <span className="truncate">{person.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Textarea
        ref={box}
        value={text}
        rows={2}
        placeholder={placeholder}
        aria-label={placeholder}
        className="max-h-48 min-h-11 resize-none"
        onChange={(event) => {
          setText(event.target.value)
          updateQuery(event.target.value, event.target.selectionStart ?? event.target.value.length)
        }}
        onKeyDown={(event) => {
          if (matches.length) {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault()
              setHighlight((h) => (h + (event.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length)
              return
            }
            if (event.key === "Enter" || event.key === "Tab") {
              event.preventDefault()
              pick(matches[highlight])
              return
            }
            if (event.key === "Escape") {
              setQuery(null)
              return
            }
          }
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault()
            void send()
          }
        }}
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox checked={instruction} onCheckedChange={(value) => setInstruction(value === true)} />
          Send as an instruction for agents
        </label>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline">Enter to send, Shift+Enter for a new line</span>
          <Button size="sm" onClick={() => void send()} disabled={!text.trim() || sending}>
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}

// -- thread ------------------------------------------------------------------

function ThreadPane({
  channel,
  canModerate,
  rootId,
  directory,
  onClose,
}: {
  channel: Channel
  canModerate: boolean
  rootId: string
  directory: Map<string, ChatPerson>
  onClose: () => void
}) {
  const [data, setData] = useState<{ root: ChatMessage; replies: ChatMessage[] } | null>(null)
  const [error, setError] = useState("")
  const endRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const page = await chatApi.thread(channel.id, rootId)
      setData({ root: page.root, replies: page.replies })
    } catch (caught) {
      setError(explain(caught))
    }
  }, [channel.id, rootId])

  usePoll(() => void load(), [load])
  useEffect(() => endRef.current?.scrollIntoView({ block: "end" }), [data?.replies.length])

  return (
    <aside
      aria-label="Thread"
      className="fixed inset-0 z-40 flex flex-col bg-background md:static md:z-auto md:w-96 md:shrink-0 md:border-l"
    >
      <header className="flex h-12 shrink-0 items-center justify-between border-b px-3">
        <h2 className="text-sm font-semibold">Thread</h2>
        <Button variant="ghost" size="icon-sm" aria-label="Close thread" onClick={onClose}>
          <XIcon aria-hidden="true" />
        </Button>
      </header>
      <div className="flex-1 overflow-y-auto py-2">
        {data ? (
          <>
            <MessageRow message={data.root} directory={directory} canModerate={canModerate} inThread onChanged={() => void load()} />
            <p className="px-4 py-1 text-xs text-muted-foreground">
              {data.replies.length} {data.replies.length === 1 ? "reply" : "replies"}
            </p>
            {data.replies.map((reply) => (
              <MessageRow key={reply.id} message={reply} directory={directory} canModerate={canModerate} inThread onChanged={() => void load()} />
            ))}
            <div ref={endRef} />
          </>
        ) : error ? (
          <p className="p-4 text-sm text-muted-foreground">{error}</p>
        ) : (
          <MessagesSkeleton rows={3} />
        )}
      </div>
      {channel.role ? (
        <Composer
          channel={channel}
          directory={directory}
          threadRootId={rootId}
          placeholder="Reply in thread"
          onSent={(reply) => setData((current) => (current ? { ...current, replies: mergeMessages(current.replies, [reply]) } : current))}
        />
      ) : null}
    </aside>
  )
}

// -- dialogs -------------------------------------------------------------------

function NewChannelDialog({
  open,
  ws,
  onClose,
  onCreated,
}: {
  open: boolean
  ws: ChatWorkspace
  onClose: () => void
  onCreated: (channel: Channel) => void
}) {
  const [name, setName] = useState("")
  const [topic, setTopic] = useState("")
  const [isPrivate, setPrivate] = useState(false)
  const [section, setSection] = useState("")
  const [busy, setBusy] = useState(false)


  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      onCreated(
        await chatApi.createChannel({ name, topic, visibility: isPrivate ? "private" : "public", ...(section ? { section_id: section } : {}) })
      )
    } catch (caught) {
      toast.error(explain(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New channel</DialogTitle>
            <DialogDescription>Channels are where your team talks about one topic. Agents join only when someone adds them.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="channel-name">Name</Label>
            <Input
              id="channel-name"
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
              placeholder="e.g. backend"
              maxLength={80}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">Lowercase letters, numbers, - and _.</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="channel-topic">Topic (optional)</Label>
            <Input id="channel-topic" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={250} />
          </div>
          {ws.is_owner && ws.sections.length ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="channel-section">Section</Label>
              <select
                id="channel-section"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              >
                <option value="">No section</option>
                {ws.sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={isPrivate} onCheckedChange={(value) => setPrivate(value === true)} className="mt-0.5" />
            <span>
              Private
              <span className="block text-xs text-muted-foreground">Only people you add can see it.</span>
            </span>
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || busy}>
              Create channel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function PeoplePicker({
  people,
  chosen,
  onToggle,
}: {
  people: ChatPerson[]
  chosen: Set<string>
  onToggle: (principal: string) => void
}) {
  const [filter, setFilter] = useState("")
  const shown = people.filter((p) => p.name.toLowerCase().includes(filter.toLowerCase()))
  return (
    <div className="flex flex-col gap-2">
      <Input placeholder="Search people and agents" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Search people and agents" />
      <ul className="max-h-64 overflow-y-auto rounded-md border p-1">
        {shown.length ? (
          shown.map((person) => {
            const principal = principalOf(person)
            return (
              <li key={principal}>
                <label className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted">
                  <Checkbox checked={chosen.has(principal)} onCheckedChange={() => onToggle(principal)} />
                  {person.type === "agent" ? <AgentTag /> : <HumanAvatar name={person.name} />}
                  <span className="truncate">{person.name}</span>
                </label>
              </li>
            )
          })
        ) : (
          <li className="px-2 py-1.5 text-sm text-muted-foreground">No one matches.</li>
        )}
      </ul>
    </div>
  )
}

function useChosen() {
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const toggle = (principal: string) =>
    setChosen((current) => {
      const next = new Set(current)
      if (next.has(principal)) next.delete(principal)
      else next.add(principal)
      return next
    })
  return [chosen, toggle] as const
}

function NewDmDialog({
  open,
  ws,
  onClose,
  onOpened,
}: {
  open: boolean
  ws: ChatWorkspace
  onClose: () => void
  onOpened: (channel: Channel) => void
}) {
  const me = useAuthUser()
  const [chosen, toggle] = useChosen()
  const people = [...ws.people.filter((p) => p.id !== me?._id), ...ws.agents]
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New direct message</DialogTitle>
          <DialogDescription>Pick up to 7 people or agents.</DialogDescription>
        </DialogHeader>
        <PeoplePicker people={people} chosen={chosen} onToggle={toggle} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!chosen.size || chosen.size > 7}
            onClick={() =>
              void chatApi
                .openDm([...chosen])
                .then(onOpened)
                .catch((caught) => toast.error(explain(caught)))
            }
          >
            Start conversation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AddPeopleDialog({ open, ws, channel, onClose }: { open: boolean; ws: ChatWorkspace; channel: Channel; onClose: () => void }) {
  const [chosen, toggle] = useChosen()
  const [busy, setBusy] = useState(false)
  const add = async () => {
    setBusy(true)
    try {
      for (const principal of chosen) await chatApi.addMember(channel.id, principal)
      toast.success(`Added to #${channel.name}`)
      onClose()
    } catch (caught) {
      toast.error(explain(caught))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to #{channel.name}</DialogTitle>
          <DialogDescription>Agents you add are woken only when someone @mentions them.</DialogDescription>
        </DialogHeader>
        <PeoplePicker people={[...ws.people, ...ws.agents]} chosen={chosen} onToggle={toggle} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!chosen.size || busy} onClick={() => void add()}>
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditChannelDialog({
  open,
  channel,
  onClose,
  onSaved,
}: {
  open: boolean
  channel: Channel
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(channel.name)
  const [topic, setTopic] = useState(channel.topic)
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void chatApi
              .updateChannel(channel.id, { name, topic })
              .then(onSaved)
              .catch((caught) => toast.error(explain(caught)))
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit #{channel.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, "-"))} maxLength={80} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-topic">Topic</Label>
            <Input id="edit-topic" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={250} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function BrowseDialog({
  open,
  channels,
  onClose,
  onOpen,
}: {
  open: boolean
  channels: Channel[]
  onClose: () => void
  onOpen: (id: string) => void
}) {
  const [filter, setFilter] = useState("")
  const shown = channels.filter((c) => c.name.includes(filter.toLowerCase()))
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Browse channels</DialogTitle>
          <DialogDescription>Public channels you haven&apos;t joined yet.</DialogDescription>
        </DialogHeader>
        <Input placeholder="Search channels" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Search channels" />
        <ul className="max-h-72 overflow-y-auto">
          {shown.length ? (
            shown.map((channel) => (
              <li key={channel.id}>
                <button
                  type="button"
                  onClick={() => onOpen(channel.id)}
                  className="flex w-full flex-col items-start rounded-md px-2 py-2 text-left hover:bg-muted"
                >
                  <span className="text-sm font-medium"># {channel.name}</span>
                  {channel.topic ? <span className="text-xs text-muted-foreground">{channel.topic}</span> : null}
                </button>
              </li>
            ))
          ) : (
            <li className="px-2 py-2 text-sm text-muted-foreground">You&apos;re in every public channel.</li>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  )
}

function SectionDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("")
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void chatApi
              .createSection(name)
              .then(() => {
                onClose()
                onSaved()
              })
              .catch((caught) => toast.error(explain(caught)))
          }}
        >
          <DialogHeader>
            <DialogTitle>New section</DialogTitle>
            <DialogDescription>Sections group channels in everyone&apos;s sidebar. Move a channel into one from its menu.</DialogDescription>
          </DialogHeader>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Engineering" aria-label="Section name" autoFocus />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Create section
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// -- states ------------------------------------------------------------------

function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center animate-in fade-in duration-300 motion-reduce:animate-none">
      <MessagesSquareIcon className="size-10 text-muted-foreground" aria-hidden="true" />
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
      {action}
    </div>
  )
}

function MessagesSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-4 p-4">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
      ))}
    </div>
  )
}

function ChatSkeleton() {
  return (
    <div className="mx-auto flex h-[calc(100svh-3.5rem)] max-w-screen-2xl">
      <div className="hidden w-64 flex-col gap-2 border-r p-3 md:flex">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
      <div className="flex-1">
        <MessagesSkeleton />
      </div>
    </div>
  )
}
