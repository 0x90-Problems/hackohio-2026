"use client"

import { useEffect, useState } from "react"

import { ActorBadge } from "@/components/actor-badge"
import { nodeSize } from "@/components/files/file-panels"
import { IMAGE_TYPES, NodeIcon, Thumbnail } from "@/components/files/thumbnail"
import { ChevronDownIcon, ChevronRightIcon, FolderIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { absoluteTime } from "@/lib/format"
import { type Crumb, type Folder, foldersApi, ROOT } from "@/lib/folders-api"
import { cn } from "@/lib/utils"

// Explorer mode: a tree of everything, a list of the current folder, and a preview of the
// selected item. Same data and actions as the grid; only the layout differs. It stays
// mounted while moving between folders, so the tree keeps what you've opened.
export function ExplorerView({
  items,
  loading,
  emptyText,
  folderId,
  crumbs,
  rootLabel,
  showTrash,
  onOpenFolder,
  onOpen,
  actions,
}: {
  items: Folder[]
  loading: boolean
  emptyText: string
  folderId: string
  crumbs: Crumb[]
  rootLabel: string
  showTrash: boolean
  onOpenFolder: (id: string) => void
  onOpen: (node: Folder) => void
  actions: (node: Folder) => React.ReactNode
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = loading ? null : (items.find((item) => item.id === selectedId) ?? null)

  const open = (node: Folder) => (node.type === "folder" && !showTrash ? onOpenFolder(node.id) : onOpen(node))
  // A folder takes you into it, in the tree and the list. Anything else is previewed.
  const pick = (node: Folder) => (node.type === "folder" && !showTrash ? onOpenFolder(node.id) : setSelectedId(node.id))
  // Picking a file elsewhere in the tree moves to its folder too, so it can be previewed there.
  const pickInTree = (node: Folder, parentId: string) => {
    setSelectedId(node.id)
    if (parentId !== folderId) onOpenFolder(parentId)
  }

  return (
    // Fills the window below the page header; each pane scrolls on its own.
    <div className="grid min-h-[28rem] overflow-hidden rounded-xl border md:h-[calc(100dvh-16rem)] md:grid-cols-[15rem_minmax(0,1fr)] lg:grid-cols-[16rem_minmax(0,1fr)_22rem] 2xl:grid-cols-[18rem_minmax(0,1fr)_26rem]">
      {!showTrash ? (
        <nav aria-label="Folder tree" className="hidden overflow-y-auto border-r bg-muted/20 p-2 md:block">
          <ul role="tree" aria-label="Folders" className="flex flex-col text-sm">
            <TreeNode
              id={ROOT}
              name={rootLabel}
              depth={0}
              tree={{ folderId, items, loading, openIds: crumbs.map((crumb) => crumb.id), selectedId, onOpenFolder, onPick: pickInTree, onOpen }}
              initiallyOpen
            />
          </ul>
        </nav>
      ) : (
        <div className="hidden border-r bg-muted/20 p-4 text-sm text-muted-foreground md:block">Trash</div>
      )}

      <div className="flex min-w-0 flex-col overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background text-left text-xs text-muted-foreground">
            <tr className="border-b">
              {/* The name takes all the room the other columns don't need. */}
              <th className="w-full px-3 py-2 font-medium">Name</th>
              <th className="hidden px-3 py-2 font-medium whitespace-nowrap sm:table-cell">Version</th>
              <th className="hidden px-3 py-2 font-medium whitespace-nowrap sm:table-cell">Size</th>
              <th className="hidden px-3 py-2 font-medium whitespace-nowrap xl:table-cell">{showTrash ? "Trashed" : "Modified"}</th>
              <th className="w-10 px-3 py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody aria-busy={loading}>
            {loading &&
              Array.from({ length: 4 }, (_, i) => (
                <tr key={i} className="border-b">
                  <td colSpan={5} className="px-3 py-2">
                    <Skeleton className="h-8 w-full" />
                  </td>
                </tr>
              ))}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                  {emptyText}
                </td>
              </tr>
            )}
            {!loading && items.map((node) => (
              <tr
                key={node.id}
                aria-selected={node.id === selectedId}
                tabIndex={0}
                onClick={() => pick(node)}
                onDoubleClick={() => open(node)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") open(node)
                  if (event.key === " ") {
                    event.preventDefault()
                    setSelectedId(node.id)
                  }
                }}
                className={cn(
                  "cursor-default border-b last:border-b-0 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none",
                  node.id === selectedId && "bg-muted"
                )}
              >
                <td className="max-w-0 px-3 py-2">
                  <span className="flex items-center gap-2">
                    {showTrash ? <NodeIcon node={node} /> : <Thumbnail node={node} variant="row" />}
                    <span className="truncate font-medium" title={node.name}>
                      {node.name}
                    </span>
                  </span>
                </td>
                <td className="hidden px-3 py-2 text-muted-foreground sm:table-cell">{node.current_version ? `v${node.current_version}` : ""}</td>
                <td className="hidden px-3 py-2 whitespace-nowrap text-muted-foreground sm:table-cell">{node.size !== undefined && node.type !== "folder" ? nodeSize(node.size) : ""}</td>
                <td className="hidden px-3 py-2 whitespace-nowrap text-muted-foreground xl:table-cell">
                  {(showTrash ? node.deleted_at : node.updated_at) ? absoluteTime(new Date((showTrash ? node.deleted_at : node.updated_at)!)) : ""}
                </td>
                <td className="px-2 py-1 text-right" onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
                  {actions(node)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-auto border-t px-3 py-2 text-xs text-muted-foreground">
          Click a folder to go into it · click anything else to preview, double-click to open
        </p>
      </div>

      <aside aria-label="Preview" className="overflow-y-auto border-t p-4 lg:border-t-0 lg:border-l">
        {selected ? (
          <Preview key={`${selected.id}:${selected.current_version ?? ""}`} node={selected} showTrash={showTrash} onOpen={() => open(selected)} />
        ) : (
          <p className="text-sm text-muted-foreground">Select an item to preview it.</p>
        )}
      </aside>
    </div>
  )
}

type Tree = {
  folderId: string
  items: Folder[]
  loading: boolean
  openIds: string[]
  selectedId: string | null
  onOpenFolder: (id: string) => void
  onPick: (node: Folder, parentId: string) => void
  onOpen: (node: Folder) => void
}

// A folder in the tree; what's inside loads the first time it's expanded. The folder
// being viewed uses the list's items, so the two always agree.
function TreeNode({ id, name, depth, tree, initiallyOpen = false }: { id: string; name: string; depth: number; tree: Tree; initiallyOpen?: boolean }) {
  const current = id === tree.folderId
  const onPath = current || tree.openIds.includes(id)
  const [expanded, setExpanded] = useState(initiallyOpen || onPath)
  const [wasOnPath, setWasOnPath] = useState(onPath)
  const [fetched, setFetched] = useState<Folder[] | null>(null)
  const live = current && !tree.loading ? tree.items : null
  const [kept, setKept] = useState<Folder[] | null>(null)
  const children = live ?? kept ?? fetched

  // Moving into a folder from anywhere opens the tree down to it.
  if (onPath !== wasOnPath) {
    setWasOnPath(onPath)
    if (onPath) setExpanded(true)
  }
  // Remember the latest list for after we've moved on from this folder.
  if (live && live !== kept) setKept(live)

  useEffect(() => {
    if (!expanded || current || children !== null) return
    let cancelled = false
    foldersApi
      .children(id)
      .then((page) => {
        if (!cancelled) setFetched(page.items)
      })
      .catch(() => {
        if (!cancelled) setFetched([])
      })
    return () => {
      cancelled = true
    }
  }, [expanded, current, children, id])

  return (
    <li role="treeitem" aria-expanded={expanded} aria-selected={current}>
      <div className={cn("flex items-center gap-0.5 rounded-md", current && "bg-muted font-medium")} style={{ paddingLeft: depth * 12 }}>
        <button
          type="button"
          aria-label={expanded ? `Collapse ${name}` : `Expand ${name}`}
          onClick={() => setExpanded((open) => !open)}
          className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted"
        >
          {expanded ? <ChevronDownIcon className="size-3.5" aria-hidden="true" /> : <ChevronRightIcon className="size-3.5" aria-hidden="true" />}
        </button>
        <button
          type="button"
          onClick={() => tree.onOpenFolder(id)}
          aria-current={current ? "location" : undefined}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-1 text-left hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <FolderIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate">{name}</span>
        </button>
      </div>
      {expanded && (
        <ul role="group" className="flex flex-col">
          {children === null && <Skeleton className="my-1 ml-8 h-5" />}
          {children?.map((child) =>
            child.type === "folder" ? (
              <TreeNode key={child.id} id={child.id} name={child.name} depth={depth + 1} tree={tree} />
            ) : (
              <li key={child.id} role="treeitem" aria-selected={child.id === tree.selectedId}>
                <button
                  type="button"
                  title={child.name}
                  onClick={() => tree.onPick(child, id)}
                  onDoubleClick={() => tree.onOpen(child)}
                  style={{ paddingLeft: (depth + 1) * 12 + 28 }}
                  className={cn(
                    "flex w-full min-w-0 items-center gap-1.5 rounded-md py-1 pr-1 text-left hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                    child.id === tree.selectedId && "bg-muted"
                  )}
                >
                  <NodeIcon node={child} />
                  <span className="truncate">{child.name}</span>
                </button>
              </li>
            )
          )}
        </ul>
      )}
    </li>
  )
}

const TEXT_TYPES = ["text/plain", "text/markdown", "text/csv", "application/json"]

function Preview({ node, showTrash, onOpen }: { node: Folder; showTrash: boolean; onOpen: () => void }) {
  const [image, setImage] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [text, setText] = useState<{ body: string; truncated: boolean } | null>(null)
  const isImage = node.type === "file" && IMAGE_TYPES.includes(node.content_type ?? "")
  const isText = node.type === "file" && TEXT_TYPES.includes(node.content_type ?? "")
  const isPdf = node.type === "file" && node.content_type === "application/pdf"

  useEffect(() => {
    if (showTrash) return
    let cancelled = false
    if (isImage) {
      foldersApi
        .link(node.id)
        .then((link) => !cancelled && setImage(link.url))
        .catch(() => !cancelled && setImage(""))
    } else if (node.type === "note") {
      foldersApi
        .readNote(node.id)
        .then((result) => !cancelled && setNote(result.body ?? ""))
        .catch(() => !cancelled && setNote(""))
    } else if (isText) {
      foldersApi
        .content(node.id)
        .then((result) => !cancelled && setText({ body: result.text, truncated: result.truncated }))
        .catch(() => !cancelled && setText({ body: "", truncated: false }))
    }
    return () => {
      cancelled = true
    }
  }, [node.id, node.type, isImage, isText, showTrash])

  async function openPdf() {
    // Opens in the browser's own PDF viewer, on the storage domain (never ours).
    const viewer = window.open("about:blank", "_blank")
    try {
      const link = await foldersApi.link(node.id, undefined, true)
      if (viewer) {
        viewer.opener = null
        viewer.location.href = link.url
      }
    } catch {
      viewer?.close()
    }
  }

  const kind = node.type === "folder" ? "Folder" : node.type === "note" ? "Document" : node.type === "whiteboard" ? "Whiteboard" : node.content_type || "File"
  const who = showTrash ? node.deleted_by : node.created_by

  return (
    <div className="flex flex-col gap-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      <div className="flex items-start gap-2">
        <NodeIcon node={node} className="mt-0.5 size-5" />
        <h2 className="min-w-0 font-semibold break-words">{node.name}</h2>
      </div>

      {isImage &&
        !showTrash &&
        (image === null ? (
          <Skeleton className="aspect-video w-full" />
        ) : image ? (
          // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL, not a static asset
          <img src={image} alt={`Preview of ${node.name}`} className="max-h-[50dvh] w-full rounded-lg border object-contain" />
        ) : (
          <p className="text-sm text-muted-foreground">No preview available.</p>
        ))}

      {isText &&
        !showTrash &&
        (text === null ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="flex flex-col gap-1">
            <pre className="max-h-[50dvh] overflow-auto rounded-lg border bg-muted/30 p-3 font-mono text-xs break-words whitespace-pre-wrap">
              {text.body || <span className="text-muted-foreground">This file is empty.</span>}
            </pre>
            {text.truncated && <p className="text-xs text-muted-foreground">Showing the first 256 KB.</p>}
          </div>
        ))}

      {isPdf && !showTrash && (
        <Button variant="outline" onClick={() => void openPdf()}>
          Open preview
        </Button>
      )}

      {node.type === "whiteboard" && !showTrash && <Thumbnail node={node} variant="card" />}

      {node.type === "note" &&
        !showTrash &&
        (note === null ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          // Plain text: note bodies are user content, never rendered as HTML.
          <div className="max-h-[50dvh] overflow-y-auto rounded-lg border bg-muted/30 p-3 text-xs break-words whitespace-pre-wrap">
            {note.slice(0, 4000) || <span className="text-muted-foreground">This document is empty.</span>}
          </div>
        ))}

      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">Type</dt>
        <dd className="truncate">{kind}</dd>
        {node.type !== "folder" && node.current_version && (
          <>
            <dt className="text-muted-foreground">Version</dt>
            <dd>v{node.current_version}</dd>
          </>
        )}
        {node.type !== "folder" && node.size !== undefined && (
          <>
            <dt className="text-muted-foreground">Size</dt>
            <dd>{nodeSize(node.size)}</dd>
          </>
        )}
        {(showTrash ? node.deleted_at : node.updated_at) && (
          <>
            <dt className="text-muted-foreground">{showTrash ? "Trashed" : "Modified"}</dt>
            <dd>{absoluteTime(new Date((showTrash ? node.deleted_at : node.updated_at)!))}</dd>
          </>
        )}
        {who && (
          <>
            <dt className="text-muted-foreground">{showTrash ? "By" : "Created by"}</dt>
            <dd>
              <ActorBadge actor={who} interactive={false} />
            </dd>
          </>
        )}
        {node.acl_mode === "restricted" && (
          <>
            <dt className="text-muted-foreground">Access</dt>
            <dd>Restricted</dd>
          </>
        )}
      </dl>

      {!showTrash && (
        <Button variant="outline" onClick={onOpen}>
          {node.type === "folder" ? "Open folder" : node.type === "note" ? "Open document" : node.type === "whiteboard" ? "Open board" : "Open file"}
        </Button>
      )}
    </div>
  )
}
