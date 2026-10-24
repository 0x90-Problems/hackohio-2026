"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import type Anthropic from "@anthropic-ai/sdk"

import { DEFAULT_PROJECT_KEY, currentUser } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import { ASSISTANT_SUGGESTIONS, offlineReply } from "@/lib/assistant/offline"
import {
  runTool,
  type ToolAction,
  type ToolContext,
} from "@/lib/assistant/tools"
import { useProjects } from "@/components/projects/projects-store"
import { ticketHref } from "@/components/board/ticket-modal"
import { AgentTag } from "@/components/actor-badge"
import {
  ArrowUpIcon,
  BotIcon,
  CheckIcon,
  MessageCircleIcon,
  XIcon,
} from "@/components/icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

type ChatMessage = {
  id: number
  role: "user" | "assistant"
  text: string
  actions: ToolAction[]
  error?: boolean
}

// Pages that show without the assistant
const HIDDEN_ON = ["/login"]
// Most tool rounds per question, so a confused model can't loop forever
const MAX_ROUNDS = 8

// "Ask the assistant" button in the bottom-right corner of every page. It opens
// a chat with the Board assistant, an agent acting for you: it answers
// questions about tickets and makes changes on the board, which show up there
// as done by "Board assistant". Uses Claude when the server has an API key
// (app/api/chat), otherwise a built-in offline assistant.
export function ChatDock() {
  const pathname = usePathname()
  const store = useProjects()
  const [open, setOpen] = useState(false)
  const [ai, setAi] = useState<boolean | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  // The conversation in Claude's format, kept exactly as the API returned it
  const history = useRef<Anthropic.Beta.BetaMessageParam[]>([])
  const nextId = useRef(0)
  const listRef = useRef<HTMLDivElement>(null)
  // The latest store, for tool calls that finish after a re-render
  const storeRef = useRef(store)
  useEffect(() => {
    storeRef.current = store
  }, [store])

  const currentProjectKey =
    pathname.match(/^\/projects\/([^/]+)/)?.[1] ?? DEFAULT_PROJECT_KEY
  const toolContext = (): ToolContext => ({
    store: storeRef.current,
    currentProjectKey,
  })

  // Ask the server once whether the AI is available
  useEffect(() => {
    fetch("/api/chat")
      .then((r) => r.json())
      .then((d: { ai?: boolean }) => setAi(Boolean(d.ai)))
      .catch(() => setAi(false))
  }, [])

  // Keep the newest message in view
  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    })
  }, [messages])

  if (HIDDEN_ON.includes(pathname)) return null

  function addMessage(message: Omit<ChatMessage, "id">) {
    const id = nextId.current++
    setMessages((current) => [...current, { ...message, id }])
    return id
  }

  function updateMessage(id: number, change: (m: ChatMessage) => ChatMessage) {
    setMessages((current) => current.map((m) => (m.id === id ? change(m) : m)))
  }

  async function send(text: string) {
    const question = text.trim()
    if (!question || busy) return
    setDraft("")
    addMessage({ role: "user", text: question, actions: [] })
    setBusy(true)
    try {
      if (ai) await askClaude(question)
      else {
        const reply = offlineReply(question, toolContext())
        addMessage({ role: "assistant", ...reply })
      }
    } finally {
      setBusy(false)
    }
  }

  async function askClaude(question: string) {
    history.current.push({ role: "user", content: question })
    const replyId = addMessage({ role: "assistant", text: "", actions: [] })

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.current }),
      }).catch(() => null)
      if (!response?.ok || !response.body) {
        updateMessage(replyId, (m) => ({
          ...m,
          text: "I couldn't reach the server. Try again.",
          error: true,
        }))
        return
      }

      // Read the reply line by line as it streams in
      let final: {
        content: Anthropic.Beta.BetaContentBlock[]
        stop_reason: string
      } | null = null
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines.filter(Boolean)) {
          const event = JSON.parse(line)
          if (event.type === "text") {
            updateMessage(replyId, (m) => ({ ...m, text: m.text + event.text }))
          } else if (event.type === "message") {
            final = event
          } else if (event.type === "error") {
            updateMessage(replyId, (m) => ({
              ...m,
              text: m.text || event.message,
              error: !m.text,
            }))
            return
          }
        }
      }
      if (!final) return

      // Keep the reply exactly as returned (thinking blocks included)
      history.current.push({ role: "assistant", content: final.content })

      if (final.stop_reason === "refusal") {
        updateMessage(replyId, (m) => ({
          ...m,
          text: m.text || "I can't help with that one.",
        }))
        return
      }
      const toolCalls = final.content.filter(
        (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use"
      )
      // A tool input cut off at max_tokens may be incomplete: don't run it
      if (final.stop_reason !== "tool_use" || toolCalls.length === 0) return

      // Run every tool call, then send all results back in one message
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = toolCalls.map(
        (call) => {
          const outcome = runTool(call.name, call.input, toolContext())
          if (outcome.action) {
            updateMessage(replyId, (m) => ({
              ...m,
              actions: [...m.actions, outcome.action!],
            }))
          }
          return {
            type: "tool_result",
            tool_use_id: call.id,
            content: JSON.stringify(outcome.result),
            ...(outcome.isError && { is_error: true }),
          }
        }
      )
      history.current.push({ role: "user", content: results })
      // Separate what the assistant says after using its tools
      updateMessage(replyId, (m) => ({
        ...m,
        text: m.text && !m.text.endsWith("\n") ? m.text + "\n\n" : m.text,
      }))
    }
  }

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-3">
      <AnimatePresence>
        {open && (
          <motion.section
            key="panel"
            aria-label="Board assistant"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            style={{ transformOrigin: "bottom right" }}
            className="flex h-[min(34rem,calc(100svh-6.5rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border bg-popover text-popover-foreground shadow-2xl"
          >
            {/* Header */}
            <header className="flex items-center gap-2 border-b px-4 py-3">
              <span className="flex size-8 items-center justify-center rounded-full border border-dashed border-muted-foreground/60 bg-muted">
                <BotIcon className="size-4" aria-hidden />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  Board assistant <AgentTag />
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  Acting for {currentUser.name} ·{" "}
                  {ai === null
                    ? "connecting…"
                    : ai
                      ? "powered by Claude"
                      : "offline mode"}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close assistant"
                onClick={() => setOpen(false)}
              >
                <XIcon />
              </Button>
            </header>

            {/* Messages */}
            <div
              ref={listRef}
              className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
              aria-live="polite"
            >
              {messages.length === 0 && (
                <div className="flex flex-col gap-3 text-sm">
                  <p className="text-muted-foreground">
                    Hi {currentUser.name}! Ask me about your tickets, or tell me
                    what to change. Everything I do shows up on the board as
                    done by an agent acting for you.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ASSISTANT_SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => send(s)}
                        className="rounded-full border px-3 py-1 text-xs transition-colors hover:bg-muted"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <AnimatePresence initial={false}>
                {messages.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      "flex flex-col gap-1.5",
                      m.role === "user" ? "items-end" : "items-start"
                    )}
                  >
                    {(m.text || m.role === "user") && (
                      <p
                        className={cn(
                          "max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
                          m.role === "user"
                            ? "bg-foreground text-background"
                            : "border border-dashed border-muted-foreground/50 bg-muted/60",
                          m.error && "border-destructive/50 text-destructive"
                        )}
                      >
                        {m.text}
                      </p>
                    )}
                    {m.role === "assistant" &&
                      !m.text &&
                      m.actions.length === 0 &&
                      busy && (
                        <p className="rounded-2xl border border-dashed border-muted-foreground/50 bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
                          <span className="animate-pulse">Thinking…</span>
                        </p>
                      )}
                    {m.actions.map((a, i) => (
                      <motion.div
                        key={`${a.label}-${i}`}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 30,
                        }}
                      >
                        {a.ticketKey ? (
                          <Link href={ticketHref(a.ticketKey)} scroll={false}>
                            <Badge
                              variant="outline"
                              className="h-auto gap-1 py-1 font-normal hover:bg-muted"
                            >
                              <CheckIcon /> {a.label}
                            </Badge>
                          </Link>
                        ) : (
                          <Badge
                            variant="outline"
                            className="h-auto gap-1 py-1 font-normal"
                          >
                            <CheckIcon /> {a.label}
                          </Badge>
                        )}
                      </motion.div>
                    ))}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Input */}
            <form
              className="flex items-end gap-2 border-t p-3"
              onSubmit={(e) => {
                e.preventDefault()
                send(draft)
              }}
            >
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    send(draft)
                  }
                }}
                placeholder="Ask or tell the assistant…"
                aria-label="Message the assistant"
                rows={1}
                className="max-h-28 min-h-9 resize-none"
              />
              <Button
                type="submit"
                size="icon"
                variant="secondary"
                aria-label="Send"
                disabled={!draft.trim() || busy}
              >
                <ArrowUpIcon />
              </Button>
            </form>
          </motion.section>
        )}
      </AnimatePresence>

      <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
        <Button
          variant="outline"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="h-11 gap-2 rounded-full border-dashed bg-popover px-4 shadow-lg"
        >
          {open ? <XIcon /> : <MessageCircleIcon />}
          <span className="hidden sm:inline">
            {open ? "Close" : "Ask the assistant"}
          </span>
          <span className="sr-only sm:hidden">
            {open ? "Close assistant" : "Ask the assistant"}
          </span>
        </Button>
      </motion.div>
    </div>
  )
}
