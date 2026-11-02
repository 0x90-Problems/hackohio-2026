"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import type { BinaryFileData, ExcalidrawImperativeAPI, Collaborator, SocketId } from "@excalidraw/excalidraw/types"
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types"
import "@excalidraw/excalidraw/index.css"

import { ActorBadge } from "@/components/actor-badge"
import { useAuthUser } from "@/components/auth/auth-gate"
import { OutlinePanel } from "@/components/whiteboard/outline-panel"
import { VersionsPanel } from "@/components/whiteboard/versions-panel"
import { BotIcon, ChevronLeftIcon, DownloadIcon, HistoryIcon, ListTreeIcon, LockIcon, PenToolIcon, SaveIcon, Undo2Icon, WifiIcon, WifiOffIcon } from "@/components/icons"
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
import { foldersApi, FoldersError, ROOT, type Version } from "@/lib/folders-api"
import type { Actor } from "@/lib/types"
import { useBoardDirectory } from "@/lib/use-board-directory"
import { type AgentActivity, type BoardInfo, type BoardSettings, type WireElement, WhiteboardError, whiteboardApi } from "@/lib/whiteboard-api"
import { Autosaver } from "@/lib/whiteboard-autosave"
import { exportFileName, ImageLoader, isFileRef, versionFileName } from "@/lib/whiteboard-files"
import { fetchBoardImage, uploadBoardImage } from "@/lib/whiteboard-images"
import { BoardSync, type Status } from "@/lib/whiteboard-live"
import { outlineOf, type OutlineElement, type OutlineRow } from "@/lib/whiteboard-outline"
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

type Panel = "versions" | "outline" | null
type ExportKind = "png" | "svg"

const OUTLINE_REFRESH_MS = 400 // the editor reports a change on every pointer move
const EXPORT_PADDING = 16
const CURSOR_TTL_MS = 60_000
const AGENT_SHOWN_MS = 10_000 // an agent's cursor and note stay on its last change this long
// Neutral cursor colours only (no blue or purple).
const CURSOR_COLORS = ["#dc2626", "#525252", "#b45309", "#15803d", "#0f766e", "#be123c"]

function saveToDevice(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function reasonFor(error: unknown) {
  return error instanceof WhiteboardError || error instanceof FoldersError || error instanceof Error ? error.message : undefined
}

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
  const [panel, setPanel] = useState<Panel>(null)
  const [saving, setSaving] = useState(false)
  const [versionsKey, setVersionsKey] = useState(0)
  const [confirmRestore, setConfirmRestore] = useState<Version | null>(null)
  const [restoring, setRestoring] = useState<number | null>(null)
  const [exporting, setExporting] = useState(false)
  const [outlineRows, setOutlineRows] = useState<OutlineRow[]>([])
  const [outlineSelected, setOutlineSelected] = useState<ReadonlySet<string>>(new Set())

  const api = useRef<ExcalidrawImperativeAPI | null>(null)
  const lib = useRef<ExcalidrawLib | null>(null)
  const sync = useRef<BoardSync | null>(null)
  const known = useRef(new Map<string, number>()) // element id -> highest version sent or received
  const cursors = useRef(new Map<string, Collaborator & { until: number }>())
  const images = useRef<ImageLoader | null>(null)
  const autosaver = useRef<Autosaver | null>(null)
  const baseVersion = useRef<number | undefined>(undefined) // the newest version this window knows of
  const boardRef = useRef<{ parentId: string; name: string } | null>(null)
  const panelRef = useRef<Panel>(null)
  const panelToggle = useRef<HTMLElement | null>(null) // where keyboard focus goes back to
  const outlineTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnedForeignImage = useRef(false)
  const restoringHere = useRef(false) // this window has its own message about a restore
  const directory = useRef({ people, agents, account })
  useEffect(() => {
    directory.current = { people, agents, account }
  }, [people, agents, account])

  // Fetch whichever images the board now shows that this window doesn't have.
  const loadImages = useCallback((elements: readonly Record<string, unknown>[]) => {
    const wanted = elements.filter((el) => el.type === "image" && !el.isDeleted).map((el) => el.fileId)
    images.current?.need(wanted.filter(isFileRef))
  }, [])

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
    loadImages(incoming)
  }, [loadImages])

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
      onSaved: (version) => {
        baseVersion.current = Math.max(baseVersion.current ?? 0, version)
        setVersionsKey((key) => key + 1)
      },
      onRestored: (version, savedAs) => {
        if (savedAs) baseVersion.current = Math.max(baseVersion.current ?? 0, savedAs)
        setVersionsKey((key) => key + 1)
        if (!restoringHere.current) toast(`Version ${version} was restored on this board.`)
      },
    })
    sync.current = live
    const loader = new ImageLoader(fetchBoardImage, (image) => {
      api.current?.addFiles([image as unknown as BinaryFileData])
    })
    images.current = loader

    void (async () => {
      try {
        const [board, excalidraw] = await Promise.all([whiteboardApi.board(boardId), import("@excalidraw/excalidraw")])
        lib.current = excalidraw
        setInfo(board)
        setReadOnly(board.role === "viewer")
        boardRef.current = { parentId: board.board.parent_id ?? ROOT, name: board.board.name }
        baseVersion.current = board.board.current_version
        await live.start()
        if (board.role !== "viewer" && !live.isClosed()) {
          const saver = new Autosaver(
            () => whiteboardApi.autosave(boardId),
            (version) => {
              baseVersion.current = Math.max(baseVersion.current ?? 0, version)
              setVersionsKey((key) => key + 1)
            }
          )
          autosaver.current = saver
          saver.start()
        }
      } catch (error) {
        setFailure(error instanceof WhiteboardError ? error.message : "Couldn't open this board.")
      }
    })()

    return () => {
      if (agentTimer) clearTimeout(agentTimer)
      live.stop()
      sync.current = null
      loader.stop()
      images.current = null
      autosaver.current?.stop()
      autosaver.current = null
    }
  }, [editorReady, boardId, applyRemote, applySettings, showCursors])

  const onApi = useCallback((editor: ExcalidrawImperativeAPI) => {
    api.current = editor
    setEditorReady(true)
  }, [])

  // The outline follows the board, but not on every pointer move.
  const refreshOutline = useCallback(() => {
    const editor = api.current
    if (!editor || panelRef.current !== "outline") return
    setOutlineRows(outlineOf(editor.getSceneElementsIncludingDeleted() as unknown as readonly OutlineElement[]))
    setOutlineSelected(new Set(Object.keys(editor.getAppState().selectedElementIds)))
  }, [])

  const onChange = useCallback(
    (elements: readonly OrderedExcalidrawElement[]) => {
      if (panelRef.current === "outline" && !outlineTimer.current) {
        outlineTimer.current = setTimeout(() => {
          outlineTimer.current = null
          refreshOutline()
        }, OUTLINE_REFRESH_MS)
      }
      if (readOnly) return
      for (const el of elements) {
        if (el.version <= (known.current.get(el.id) ?? 0)) continue
        // An image with no Files id is still uploading, or was pasted in from elsewhere. The server
        // refuses those, and a refusal drops every shape in the batch, so it mustn't be sent.
        if (el.type === "image" && !isFileRef(el.fileId)) {
          if (el.fileId && !el.isDeleted && !warnedForeignImage.current) {
            warnedForeignImage.current = true
            toast.error("That image won't be saved", { description: "It came from outside this board. Use the image tool or drop in the file, so it goes through Files." })
          }
          continue
        }
        known.current.set(el.id, el.version)
        sync.current?.queue(el as unknown as WireElement)
        autosaver.current?.noteEdit()
      }
    },
    [readOnly, refreshOutline]
  )

  // The editor calls this for the image tool, pasting and dropping. The returned id is what the
  // element stores, so the image only reaches the board once Files has it scanned and committed.
  const uploadImage = useCallback(async (file: File) => {
    const board = boardRef.current
    if (!board) throw new Error("The board is still opening. Try again in a moment.")
    const note = toast.loading("Uploading image…")
    try {
      const id = await uploadBoardImage(file, board.parentId, board.name, (status) => toast.loading(`${status} image…`, { id: note }))
      images.current?.have(id)
      toast.success("Image added", { id: note, description: `Saved in this board's folder.` })
      return id
    } catch (error) {
      toast.dismiss(note) // the editor shows what it's thrown, in its own dialog
      throw error instanceof Error ? error : new Error("Couldn't add that image.")
    }
  }, [])

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

  function togglePanel(next: Exclude<Panel, null>, event?: { currentTarget: EventTarget | null }) {
    const opening = panel !== next
    if (event?.currentTarget instanceof HTMLElement) panelToggle.current = event.currentTarget
    panelRef.current = opening ? next : null
    setPanel(opening ? next : null)
    if (opening && next === "outline") refreshOutline()
  }

  function closePanel() {
    panelRef.current = null
    setPanel(null)
    panelToggle.current?.focus()
  }

  /** Edits on their way first, so the version holds what's on this person's screen. */
  async function saveVersion(reason = ""): Promise<boolean> {
    setSaving(true)
    try {
      const arrived = (await sync.current?.settled()) ?? true
      const out = await whiteboardApi.save(boardId, { ...(reason.trim() ? { reason: reason.trim() } : {}), ...(baseVersion.current ? { base_version: baseVersion.current } : {}) })
      if (out.version) baseVersion.current = out.version
      setVersionsKey((key) => key + 1)
      if (out.saved) {
        toast.success(`Saved as version ${out.version}`, arrived ? undefined : { description: "Your newest edits are still on their way, so they'll be in the next version." })
      } else {
        toast(out.version ? `Nothing new since version ${out.version}.` : "Nothing new to save yet.")
      }
      return true
    } catch (error) {
      if (error instanceof WhiteboardError && error.status === 409) {
        // Someone else saved. Everything drawn is live either way, so only the history is behind.
        const fresh = await foldersApi.node(boardId).catch(() => null)
        if (fresh?.current_version) baseVersion.current = fresh.current_version
        setVersionsKey((key) => key + 1)
        toast("Someone just saved a newer version", { description: "Nothing is lost. Save again if you'd like a version with your latest changes." })
        return false
      }
      toast.error("Couldn't save", { description: reasonFor(error) })
      return false
    } finally {
      setSaving(false)
    }
  }

  async function restoreVersion(version: Version) {
    setConfirmRestore(null)
    setRestoring(version.version)
    restoringHere.current = true
    const note = toast.loading(`Restoring version ${version.version}…`)
    try {
      await sync.current?.settled()
      const out = await whiteboardApi.restore(boardId, version.version, (remaining) => toast.loading(`Restoring version ${version.version}… ${remaining} left`, { id: note }))
      if (out.version) baseVersion.current = out.version
      const before = out.before_version ? ` Version ${out.before_version} has what was there before.` : ""
      toast.success(out.restored ? `Version ${version.version} is back.${before}` : `The board already matches version ${version.version}.`, { id: note })
    } catch (error) {
      toast.error("Couldn't finish restoring", { id: note, description: reasonFor(error) })
    } finally {
      setRestoring(null)
      restoringHere.current = false
      setVersionsKey((key) => key + 1)
    }
  }

  async function downloadVersion(version: Version) {
    if (!info) return
    try {
      const { body } = await foldersApi.readNote(boardId, version.version)
      let blob: Blob
      if (typeof body === "string") blob = new Blob([body], { type: "application/json" })
      else {
        const { url } = await foldersApi.link(boardId, version.version)
        const response = await fetch(url, { cache: "no-store" })
        if (!response.ok) throw new Error("The download link didn't work. Try again.")
        blob = await response.blob()
      }
      saveToDevice(blob, versionFileName(info.board.name, version.version))
    } catch (error) {
      toast.error("Couldn't download that version", { description: reasonFor(error) })
    }
  }

  // Exports run here, with the editor's own helpers. Into the folder, they're a normal upload: scanned.
  async function renderExport(kind: ExportKind): Promise<Blob | null> {
    const editor = api.current
    const excalidraw = lib.current
    if (!editor || !excalidraw) return null
    const elements = editor.getSceneElements()
    if (!elements.length) {
      toast("Nothing on this board to export yet.")
      return null
    }
    await images.current?.settled()
    const files = editor.getFiles()
    const appState = { ...editor.getAppState(), exportBackground: true, exportWithDarkMode: false }
    if (kind === "png") return excalidraw.exportToBlob({ elements, appState, files, mimeType: "image/png", exportPadding: EXPORT_PADDING })
    const svg = await excalidraw.exportToSvg({ elements, appState, files, exportPadding: EXPORT_PADDING })
    return new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" })
  }

  async function exportBoard(kind: ExportKind, to: "folder" | "device") {
    if (!info) return
    setExporting(true)
    const label = kind.toUpperCase()
    const note = toast.loading(`Exporting ${label}…`)
    try {
      const blob = await renderExport(kind)
      if (!blob) {
        toast.dismiss(note)
        return
      }
      const name = exportFileName(info.board.name, kind, new Date())
      if (to === "device") {
        saveToDevice(blob, name)
        toast.success(`${label} downloaded`, { id: note })
        return
      }
      await foldersApi.upload(new File([blob], name, { type: blob.type }), { parentId: info.board.parent_id ?? ROOT }, (status) => toast.loading(`${status} ${label}…`, { id: note }))
      toast.success(`${label} saved in this board's folder`, { id: note, description: name })
    } catch (error) {
      toast.error(`Couldn't export the ${label}`, { id: note, description: reasonFor(error) })
    } finally {
      setExporting(false)
    }
  }

  // Keyboard: the outline opens from anywhere on the page, and shapes can be reached without a pointer.
  const showShape = useCallback((id: string) => {
    const editor = api.current
    if (!editor) return
    const element = editor.getSceneElements().find((el) => el.id === id)
    if (!element) return
    editor.updateScene({ appState: { selectedElementIds: { [id]: true } } as never, captureUpdate: lib.current?.CaptureUpdateAction.NEVER })
    editor.scrollToContent(element, { fitToViewport: false, animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches })
    refreshOutline()
  }, [refreshOutline])

  const focusCanvas = useCallback(() => {
    document.querySelector<HTMLElement>(".excalidraw-container")?.focus()
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.altKey && event.shiftKey && event.key.toLowerCase() === "o") {
        event.preventDefault()
        const opening = panelRef.current !== "outline"
        if (opening && document.activeElement instanceof HTMLElement) panelToggle.current = document.activeElement
        panelRef.current = opening ? "outline" : null
        setPanel(opening ? "outline" : null)
        if (opening) refreshOutline()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      if (outlineTimer.current) clearTimeout(outlineTimer.current)
      outlineTimer.current = null
    }
  }, [refreshOutline])

  const canSave = Boolean(info && info.role !== "viewer")
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
        <div className="ml-auto flex min-w-0 items-center gap-2 overflow-x-auto [scrollbar-width:none]" aria-live="polite">
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
          {canSave ? (
            <Button variant="outline" size="sm" disabled={saving} onClick={() => void saveVersion()} aria-label="Save a version">
              <SaveIcon data-icon="inline-start" aria-hidden="true" />
              <span className="hidden sm:inline">{saving ? "Saving…" : "Save"}</span>
            </Button>
          ) : null}
          {info ? (
            <Button variant="ghost" size="sm" aria-pressed={panel === "versions"} aria-label="Versions" onClick={(event) => togglePanel("versions", event)}>
              <HistoryIcon data-icon="inline-start" aria-hidden="true" />
              <span className="hidden md:inline">Versions</span>
            </Button>
          ) : null}
          {info ? (
            <Button variant="ghost" size="sm" aria-pressed={panel === "outline"} aria-label="Outline" aria-keyshortcuts="Alt+Shift+O" title="Outline (Alt+Shift+O)" onClick={(event) => togglePanel("outline", event)}>
              <ListTreeIcon data-icon="inline-start" aria-hidden="true" />
              <span className="hidden md:inline">Outline</span>
            </Button>
          ) : null}
          {info ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" disabled={exporting} aria-label="Export">
                  <DownloadIcon data-icon="inline-start" aria-hidden="true" />
                  <span className="hidden md:inline">{exporting ? "Exporting…" : "Export"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {canSave ? (
                  <>
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Save in this board&apos;s folder</DropdownMenuLabel>
                    <DropdownMenuItem onSelect={() => void exportBoard("png", "folder")}>PNG image</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void exportBoard("svg", "folder")}>SVG image (download only)</DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                ) : null}
                <DropdownMenuLabel className="text-xs text-muted-foreground">Download to this device</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => void exportBoard("png", "device")}>PNG image</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void exportBoard("svg", "device")}>SVG image</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          {canManage ? (
            <DropdownMenu onOpenChange={(open) => open && void loadUndoable()}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" aria-label="Agents">
                  <BotIcon data-icon="inline-start" aria-hidden="true" />
                  <span className="hidden md:inline">Agents</span>
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
      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <Excalidraw
            excalidrawAPI={onApi}
            onChange={onChange}
            onPointerUpdate={onPointerUpdate}
            isCollaborating
            viewModeEnabled={readOnly}
            theme={resolvedTheme === "dark" ? "dark" : "light"}
            // Embeds are off: the server rejects them too, this just hides the tool.
            validateEmbeddable={() => false}
            generateIdForFile={uploadImage}
          />
        </div>
        {panel === "versions" ? (
          <VersionsPanel
            boardId={boardId}
            canEdit={canSave}
            refreshKey={versionsKey}
            saving={saving}
            busyVersion={restoring}
            onSave={saveVersion}
            onRestore={setConfirmRestore}
            onDownload={(version) => void downloadVersion(version)}
            onClose={closePanel}
          />
        ) : panel === "outline" ? (
          <OutlinePanel rows={outlineRows} selected={outlineSelected} onShow={showShape} onFocusCanvas={focusCanvas} onClose={closePanel} />
        ) : null}
      </div>
      <Dialog open={confirmRestore !== null} onOpenChange={(open) => !open && setConfirmRestore(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore version {confirmRestore?.version}?</DialogTitle>
            <DialogDescription>The board changes back for everyone on it, straight away. What&apos;s there now is kept as a new version first, so you can go back to it.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRestore(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => confirmRestore && void restoreVersion(confirmRestore)}>
              Restore version
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
