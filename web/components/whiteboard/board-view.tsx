"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import type { ExcalidrawImperativeAPI, Collaborator, SocketId } from "@excalidraw/excalidraw/types"
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types"
import "@excalidraw/excalidraw/index.css"

import { ActorBadge } from "@/components/actor-badge"
import { useAuthUser } from "@/components/auth/auth-gate"
import { BotIcon, ChevronLeftIcon, LockIcon, PenToolIcon, Undo2Icon, WifiIcon, WifiOffIcon } from "@/components/icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { visibleAgentName } from "@/lib/agent-label"
import type { Actor } from "@/lib/types"
import { useBoardDirectory } from "@/lib/use-board-directory"
import { type AgentActivity, type BoardInfo, type BoardSettings, type WireElement, WhiteboardError, whiteboardApi } from "@/lib/whiteboard-api"
import { BoardSync, type Status } from "@/lib/whiteboard-live"
import { ACTOR_TYPES } from "@/shared/names"

// Fonts come from this site (copied at build time), not Excalidraw's default CDN,
// which the page's CSP blocks. Must be set before the editor loads.
if (typeof window !== "undefined") {
  ;(window as Window & { EXCALIDRAW_ASSET_PATH?: string }).EXCALIDRAW_ASSET_PATH = "/excalidraw-assets/"
}

// The editor only runs in the browser.
const Excalidraw = dynamic(() => import("@excalidraw/excalidraw").then((m) => m.Excalidraw), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none" />,
})

type ExcalidrawLib = typeof import("@excalidraw/excalidraw")
type AgentActor = Extract<Actor, { type: typeof ACTOR_TYPES.AGENT }>

const CURSOR_TTL_MS = 60_000
const AGENT_SHOWN_MS = 10_000 // an agent's cursor and note stay on its last change this long
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
  const account = useAuthUser()
  const { people, agents } = useBoardDirectory()
  const [info, setInfo] = useState<BoardInfo | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>("connecting")
  const [readOnly, setReadOnly] = useState(true)
  const [editorReady, setEditorReady] = useState(false)
  const [activity, setActivity] = useState<{ who: AgentActor; summary: string } | null>(null)
  const [undoable, setUndoable] = useState<AgentActivity[]>([])
  const [confirmUndo, setConfirmUndo] = useState<AgentActivity | null>(null)

  const api = useRef<ExcalidrawImperativeAPI | null>(null)
  const lib = useRef<ExcalidrawLib | null>(null)
  const sync = useRef<BoardSync | null>(null)
  const known = useRef(new Map<string, number>()) // element id -> highest version sent or received
  const cursors = useRef(new Map<string, Collaborator & { until: number }>())
  const directory = useRef({ people, agents, account })
  useEffect(() => {
    directory.current = { people, agents, account }
  }, [people, agents, account])

  // Remote elements go through Excalidraw's own reconcile, the same rule the server uses.
  const applyRemote = useCallback((incoming: WireElement[]) => {
    const editor = api.current
    const excalidraw = lib.current
    if (!editor || !excalidraw || !incoming.length) return
    // Agents' shapes are built by the server, without the editor's layout details: let it fill them in.
    const elements = incoming.map((el) => {
      const editor_ = (el.customData as { last_edited_by?: { type?: string } } | undefined)?.last_edited_by
      if (editor_?.type !== ACTOR_TYPES.AGENT) return el
      const [restored] = excalidraw.restoreElements([el as never], null, { refreshDimensions: true })
      return (restored ?? el) as unknown as WireElement
    })
    const merged = excalidraw.reconcileElements(
      editor.getSceneElementsIncludingDeleted(),
      elements as unknown as Parameters<ExcalidrawLib["reconcileElements"]>[1],
      editor.getAppState()
    )
    editor.updateScene({ elements: merged, captureUpdate: excalidraw.CaptureUpdateAction.NEVER })
    // The editor may number or measure these as it takes them in. That isn't an edit by this
    // person, so it mustn't be sent back: it would claim another author's shape as theirs.
    const ids = new Set(incoming.map((el) => el.id))
    for (const el of editor.getSceneElementsIncludingDeleted()) {
      if (ids.has(el.id)) known.current.set(el.id, Math.max(known.current.get(el.id) ?? 0, el.version))
    }
  }, [])

  const showCursors = useCallback(() => {
    const editor = api.current
    if (!editor) return
    const now = Date.now()
    for (const [id, c] of cursors.current) if (now > c.until) cursors.current.delete(id)
    editor.updateScene({ collaborators: new Map([...cursors.current].map(([id, c]) => [id as SocketId, c])) })
  }, [])

  const applySettings = useCallback((settings: BoardSettings) => {
    setInfo((current) => (current ? { ...current, ...settings } : current))
  }, [])

  // Once the editor exists: load the board, then keep it in sync.
  useEffect(() => {
    if (!editorReady) return
    let agentTimer: ReturnType<typeof setTimeout> | undefined
    const live = new BoardSync(boardId, {
      onElements: applyRemote,
      onStatus: setStatus,
      onReadOnly: setReadOnly,
      onFailure: setFailure,
      onRejected: (message) => toast.error(message),
      onBoard: applySettings,
      onCursor: (connection, who, x, y) => {
        cursors.current.set(connection, {
          username: who.name ?? who.id,
          pointer: { x, y, tool: "pointer" },
          color: colorFor(who.id),
          until: Date.now() + CURSOR_TTL_MS,
        })
        showCursors()
      },
      // An agent has no pointer: its cursor sits on its last change for a moment, labelled as an agent.
      onAgent: (who, summary, at) => {
        const actor = { type: ACTOR_TYPES.AGENT, id: who.id, acting_for: who.acting_for ?? "" } as AgentActor
        const { people: names, agents: bots, account: me } = directory.current
        const name = visibleAgentName(who.name, who.id, bots.find((agent) => agent._id === who.id)?.name)
        const owner = who.acting_for === me?._id ? me?.name : names.find((person) => person._id === who.acting_for)?.name
        if (at) {
          cursors.current.set(`agent:${who.id}`, {
            username: `AGENT ${name}${owner ? ` for ${owner}` : ""}`,
            pointer: { x: at.x, y: at.y, tool: "pointer" },
            until: Date.now() + AGENT_SHOWN_MS,
          })
          showCursors()
        }
        setActivity({ who: actor, summary })
        if (agentTimer) clearTimeout(agentTimer)
        agentTimer = setTimeout(() => {
          setActivity(null)
          showCursors()
        }, AGENT_SHOWN_MS + 50)
      },
    })
    sync.current = live

    void (async () => {
      try {
        const [board, excalidraw] = await Promise.all([whiteboardApi.board(boardId), import("@excalidraw/excalidraw")])
        lib.current = excalidraw
        setInfo(board)
        setReadOnly(board.role === "viewer")
        await live.start()
      } catch (error) {
        setFailure(error instanceof WhiteboardError ? error.message : "Couldn't open this board.")
      }
    })()

    return () => {
      if (agentTimer) clearTimeout(agentTimer)
      live.stop()
      sync.current = null
    }
  }, [editorReady, boardId, applyRemote, applySettings, showCursors])

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
          sync.current?.queue(el as unknown as WireElement)
        }
      }
    },
    [readOnly]
  )

  const onPointerUpdate = useCallback((payload: { pointer: { x: number; y: number } }) => {
    const selected = Object.keys(api.current?.getAppState().selectedElementIds ?? {})
    sync.current?.cursor(payload.pointer.x, payload.pointer.y, selected)
  }, [])

  async function changeSettings(change: Partial<BoardSettings>) {
    try {
      applySettings(await whiteboardApi.settings(boardId, change))
    } catch (error) {
      toast.error("Couldn't change that", { description: error instanceof WhiteboardError ? error.message : undefined })
    }
  }

  async function loadUndoable() {
    try {
      setUndoable((await whiteboardApi.agents(boardId)).agents)
    } catch {
      setUndoable([])
    }
  }

  async function undoAgent(agent: AgentActivity) {
    setConfirmUndo(null)
    try {
      const result = await whiteboardApi.undoAgent(boardId, agent.agent_id)
      const kept = result.skipped ? ` ${result.skipped} that someone edited afterwards ${result.skipped === 1 ? "was" : "were"} left as they are.` : ""
      toast.success(`Undid ${result.undone} ${result.undone === 1 ? "change" : "changes"}.${kept}`)
    } catch (error) {
      toast.error("Couldn't undo that", { description: error instanceof WhiteboardError ? error.message : undefined })
    }
  }

  const canManage = Boolean(info && info.role !== "viewer" && info.agents_enabled)
  const agentName = (id: string) => visibleAgentName(undefined, id, agents.find((agent) => agent._id === id)?.name)

  if (failure) {
    return (
      <div className="flex h-[calc(100svh-3.5rem)] flex-col items-center justify-center gap-3 p-8 text-center">
        <PenToolIcon className="size-10 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-lg font-semibold">Couldn&apos;t open this board</h1>
        <p className="max-w-sm text-sm text-muted-foreground">{failure}</p>
        <Button asChild variant="outline">
          <Link href="/boards">Back to whiteboards</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100svh-3.5rem)] flex-col">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
        <Button asChild variant="ghost" size="icon-sm" aria-label="Back to whiteboards">
          <Link href="/boards">
            <ChevronLeftIcon aria-hidden="true" />
          </Link>
        </Button>
        <PenToolIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        <h1 className="truncate text-sm font-semibold">{info?.board.name ?? <Skeleton className="h-4 w-32" />}</h1>
        <div className="ml-auto flex items-center gap-2" aria-live="polite">
          {activity ? (
            <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
              <ActorBadge actor={activity.who} interactive={false} />
              <span className="truncate">{activity.summary}</span>
            </span>
          ) : null}
          {info?.locked ? (
            <Badge variant="outline">
              <LockIcon aria-hidden="true" /> People only
            </Badge>
          ) : info?.agents_paused ? (
            <Badge variant="outline">
              <BotIcon aria-hidden="true" /> Agents paused
            </Badge>
          ) : null}
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
          {canManage ? (
            <DropdownMenu onOpenChange={(open) => open && void loadUndoable()}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <BotIcon data-icon="inline-start" aria-hidden="true" />
                  Agents
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel className="text-xs text-muted-foreground">Agents on this board</DropdownMenuLabel>
                <DropdownMenuCheckboxItem checked={Boolean(info?.locked)} onCheckedChange={(locked) => void changeSettings({ locked })}>
                  People only (lock the board)
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={Boolean(info?.agents_paused)} onCheckedChange={(agents_paused) => void changeSettings({ agents_paused })}>
                  Pause agents
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={Boolean(info?.agents_may_edit_all)} onCheckedChange={(agents_may_edit_all) => void changeSettings({ agents_may_edit_all })}>
                  Let agents change everyone&apos;s shapes
                </DropdownMenuCheckboxItem>
                {undoable.length ? <DropdownMenuSeparator /> : null}
                {undoable.map((agent) => (
                  <DropdownMenuItem key={agent.agent_id} onSelect={() => setConfirmUndo(agent)}>
                    <Undo2Icon aria-hidden="true" />
                    <span className="truncate">Undo {agentName(agent.agent_id)}&apos;s changes</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
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
      <Dialog open={confirmUndo !== null} onOpenChange={(open) => !open && setConfirmUndo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Undo {confirmUndo ? agentName(confirmUndo.agent_id) : ""}&apos;s changes?</DialogTitle>
            <DialogDescription>
              {confirmUndo?.changes} {confirmUndo?.changes === 1 ? "change goes" : "changes go"} back to how they were, for everyone on this board. Anything someone has edited since stays as it is.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmUndo(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => confirmUndo && void undoAgent(confirmUndo)}>
              Undo changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
