"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import type { ExcalidrawImperativeAPI, Collaborator, SocketId } from "@excalidraw/excalidraw/types"
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types"
import "@excalidraw/excalidraw/index.css"

import { ChevronLeftIcon, LockIcon, PenToolIcon, WifiIcon, WifiOffIcon } from "@/components/icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { type BoardInfo, type WireElement, WhiteboardError, whiteboardApi } from "@/lib/whiteboard-api"

// The editor only runs in the browser.
const Excalidraw = dynamic(() => import("@excalidraw/excalidraw").then((m) => m.Excalidraw), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none" />,
})

type ExcalidrawLib = typeof import("@excalidraw/excalidraw")
type Status = "connecting" | "live" | "reconnecting"

const FLUSH_MS = 100 // batch local edits
const CURSOR_MS = 100 // at most 10 cursor updates a second
const POLL_MS = 5_000 // while the socket is down
const MAX_BATCH = 50 // server limit per update
const RETRY_MS = [1_000, 2_000, 5_000, 10_000, 30_000]
const CURSOR_TTL_MS = 60_000
// Neutral cursor colours only (no blue or purple).
const CURSOR_COLORS = ["#dc2626", "#525252", "#b45309", "#15803d", "#0f766e", "#be123c"]

function colorFor(id: string) {
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  const stroke = CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length]
  return { background: stroke, stroke }
}

export function BoardView({ boardId }: { boardId: string }) {
  const { resolvedTheme } = useTheme()
  const [info, setInfo] = useState<BoardInfo | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>("connecting")
  const [readOnly, setReadOnly] = useState(true)
  const [editorReady, setEditorReady] = useState(false)

  const api = useRef<ExcalidrawImperativeAPI | null>(null)
  const lib = useRef<ExcalidrawLib | null>(null)
  const socket = useRef<WebSocket | null>(null)
  const seq = useRef(0)
  const known = useRef(new Map<string, number>()) // element id -> highest version sent or received
  const pending = useRef(new Map<string, WireElement>())
  const cursors = useRef(new Map<string, Collaborator & { at: number }>())
  const lastCursor = useRef(0)
  const closed = useRef(false)

  // Remote elements go through Excalidraw's own reconcile, the same rule the server uses.
  const applyRemote = useCallback((elements: WireElement[], nextSeq?: number) => {
    const editor = api.current
    const excalidraw = lib.current
    if (nextSeq) seq.current = Math.max(seq.current, nextSeq)
    if (!editor || !excalidraw || !elements.length) return
    for (const el of elements) known.current.set(el.id, Math.max(known.current.get(el.id) ?? 0, el.version))
    const merged = excalidraw.reconcileElements(
      editor.getSceneElementsIncludingDeleted(),
      elements as unknown as Parameters<ExcalidrawLib["reconcileElements"]>[1],
      editor.getAppState()
    )
    editor.updateScene({ elements: merged, captureUpdate: excalidraw.CaptureUpdateAction.NEVER })
  }, [])

  const showCursors = useCallback(() => {
    const editor = api.current
    if (!editor) return
    const now = Date.now()
    for (const [id, c] of cursors.current) if (now - c.at > CURSOR_TTL_MS) cursors.current.delete(id)
    editor.updateScene({ collaborators: new Map([...cursors.current].map(([id, c]) => [id as SocketId, c])) })
  }, [])

  const flush = useCallback(async () => {
    if (!pending.current.size) return
    const batch = [...pending.current.values()].slice(0, MAX_BATCH)
    for (const el of batch) pending.current.delete(el.id)
    const ws = socket.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: "update", elements: batch }))
      return
    }
    try {
      const out = await whiteboardApi.send(boardId, batch)
      applyRemote(out.stale, out.seq)
    } catch (error) {
      // Put them back; the next flush retries. Versions only grow, so a retry can't regress anything.
      for (const el of batch) if (!pending.current.has(el.id)) pending.current.set(el.id, el)
      if (error instanceof WhiteboardError && error.status === 403) setReadOnly(true)
    }
  }, [boardId, applyRemote])

  // Once the editor exists: load the board, then keep a live socket (polling while it's down).
  useEffect(() => {
    if (!editorReady) return
    closed.current = false
    let retry = 0
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let pollTimer: ReturnType<typeof setInterval> | undefined

    const poll = async () => {
      try {
        let page = await whiteboardApi.elements(boardId, seq.current)
        applyRemote(page.elements, page.seq)
        while (page.next_since !== null) {
          page = await whiteboardApi.elements(boardId, page.next_since)
          applyRemote(page.elements, page.seq)
        }
      } catch {
        // stay quiet; the socket or the next poll will catch up
      }
    }

    const connect = async () => {
      if (closed.current) return
      try {
        const session = await whiteboardApi.session(boardId)
        setReadOnly(session.read_only)
        const ws = new WebSocket(session.url, session.protocols)
        socket.current = ws
        ws.onopen = () => {
          retry = 0
          setStatus("live")
          if (pollTimer) clearInterval(pollTimer)
          pollTimer = undefined
          ws.send(JSON.stringify({ action: "join", since: seq.current }))
          void flush()
        }
        ws.onmessage = (event) => {
          let message: { type?: string; elements?: WireElement[]; seq?: number; who?: { id: string; name?: string }; connection?: string; x?: number; y?: number; message?: string; code?: string }
          try {
            message = JSON.parse(String(event.data))
          } catch {
            return
          }
          if (message.type === "elements" && message.elements) applyRemote(message.elements, message.seq)
          else if (message.type === "ack" && message.seq) seq.current = Math.max(seq.current, message.seq)
          else if (message.type === "cursor" && message.connection && message.who) {
            cursors.current.set(message.connection, {
              username: message.who.name ?? message.who.id,
              pointer: { x: message.x ?? 0, y: message.y ?? 0, tool: "pointer" },
              color: colorFor(message.who.id),
              at: Date.now(),
            })
            showCursors()
          } else if (message.type === "error" && message.message) toast.error(message.message)
        }
        ws.onclose = () => {
          if (socket.current === ws) socket.current = null
          if (closed.current) return
          setStatus("reconnecting")
          pollTimer ??= setInterval(() => {
            void poll()
            void flush()
          }, POLL_MS)
          retryTimer = setTimeout(() => void connect(), RETRY_MS[Math.min(retry++, RETRY_MS.length - 1)])
        }
      } catch (error) {
        if (error instanceof WhiteboardError && (error.status === 404 || error.code === "feature_disabled")) {
          setFailure(error.message)
          return
        }
        setStatus("reconnecting")
        retryTimer = setTimeout(() => void connect(), RETRY_MS[Math.min(retry++, RETRY_MS.length - 1)])
      }
    }

    void (async () => {
      try {
        const [board, excalidraw] = await Promise.all([whiteboardApi.board(boardId), import("@excalidraw/excalidraw")])
        lib.current = excalidraw
        setInfo(board)
        setReadOnly(board.role === "viewer")
        await poll() // the whole board, before going live
        await connect()
      } catch (error) {
        setFailure(error instanceof WhiteboardError ? error.message : "Couldn't open this board.")
      }
    })()

    const flusher = setInterval(() => void flush(), FLUSH_MS)
    return () => {
      closed.current = true
      clearInterval(flusher)
      if (pollTimer) clearInterval(pollTimer)
      if (retryTimer) clearTimeout(retryTimer)
      socket.current?.close()
      socket.current = null
    }
  }, [editorReady, boardId, applyRemote, flush, showCursors])

  const onApi = useCallback((editor: ExcalidrawImperativeAPI) => {
    api.current = editor
    setEditorReady(true)
  }, [])

  const onChange = useCallback(
    (elements: readonly OrderedExcalidrawElement[]) => {
      if (readOnly) return
      for (const el of elements) {
        if (el.version > (known.current.get(el.id) ?? 0)) {
          known.current.set(el.id, el.version)
          pending.current.set(el.id, el as unknown as WireElement)
        }
      }
    },
    [readOnly]
  )

  const onPointerUpdate = useCallback((payload: { pointer: { x: number; y: number } }) => {
    const now = Date.now()
    const ws = socket.current
    if (now - lastCursor.current < CURSOR_MS || !ws || ws.readyState !== WebSocket.OPEN) return
    lastCursor.current = now
    const selected = Object.keys(api.current?.getAppState().selectedElementIds ?? {})
    ws.send(JSON.stringify({ action: "cursor", x: payload.pointer.x, y: payload.pointer.y, selected }))
  }, [])

  if (failure) {
    return (
      <div className="flex h-[calc(100svh-3.5rem)] flex-col items-center justify-center gap-3 p-8 text-center">
        <PenToolIcon className="size-10 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-lg font-semibold">Couldn&apos;t open this board</h1>
        <p className="max-w-sm text-sm text-muted-foreground">{failure}</p>
        <Button asChild variant="outline">
          <Link href="/files">Back to Folders</Link>
        </Button>
      </div>
    )
  }

  const parent = info?.board.parent_id && info.board.parent_id !== "root" ? `/files?folder=${encodeURIComponent(info.board.parent_id)}` : "/files"
  return (
    <div className="flex h-[calc(100svh-3.5rem)] flex-col">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
        <Button asChild variant="ghost" size="icon-sm" aria-label="Back to the folder">
          <Link href={parent}>
            <ChevronLeftIcon aria-hidden="true" />
          </Link>
        </Button>
        <PenToolIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        <h1 className="truncate text-sm font-semibold">{info?.board.name ?? <Skeleton className="h-4 w-32" />}</h1>
        <div className="ml-auto flex items-center gap-2" aria-live="polite">
          {readOnly && info ? (
            <Badge variant="outline">
              <LockIcon aria-hidden="true" /> View only
            </Badge>
          ) : null}
          {status === "live" ? (
            <Badge variant="outline">
              <WifiIcon aria-hidden="true" /> Live
            </Badge>
          ) : status === "reconnecting" ? (
            <Badge variant="outline">
              <WifiOffIcon aria-hidden="true" /> Reconnecting… your edits are kept
            </Badge>
          ) : (
            <Badge variant="outline">Connecting…</Badge>
          )}
        </div>
      </header>
      <div className="relative min-h-0 flex-1">
        <Excalidraw
          excalidrawAPI={onApi}
          onChange={onChange}
          onPointerUpdate={onPointerUpdate}
          isCollaborating
          viewModeEnabled={readOnly}
          theme={resolvedTheme === "dark" ? "dark" : "light"}
          // Embeds are off: the server rejects them too, this just hides the tool.
          validateEmbeddable={() => false}
          // Images arrive in a later step, through scanned Files.
          UIOptions={{ tools: { image: false } }}
        />
      </div>
    </div>
  )
}
