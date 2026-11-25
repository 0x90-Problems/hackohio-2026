"use client"

// Renders one checked A2UI block (NSB-90) with the A2UI React renderer. Loaded only in the browser
// (the basic components are custom elements). Read-only: no action handler is given, so nothing a
// block does is sent anywhere; buttons can only open a pop-up or an https / NutShell link.

import { useEffect, useMemo, useState } from "react"
import { A2uiSurface, MarkdownComponentContext, type MarkdownComponentProps } from "@a2ui/react/v0_9"
import { Catalog, MessageProcessor, basicCatalog, injectBasicCatalogStyles } from "@a2ui/web_core/v0_9"

import { NutshellIcon } from "@/components/a2ui/nutshell-icon"
import { NutshellModal } from "@/components/a2ui/nutshell-modal"
import { MarkdownView } from "@/components/markdown-view"
import { ALLOWED_COMPONENTS, type A2uiBlock } from "@/lib/a2ui-block"

const CATALOG_ID = "https://nutshell.0x90problems.dev/a2ui/comment-blocks/v0_9.json"

let catalog: Catalog<never> | null = null
function commentCatalog() {
  if (catalog) return catalog
  injectBasicCatalogStyles()
  // The allowed basic components, with Modal drawn as a NutShell dialog and Icon with NutShell's icons.
  const components = [
    ...[...basicCatalog.components.values()].filter((item) => ALLOWED_COMPONENTS.includes(item.name) && item.name !== "Modal" && item.name !== "Icon"),
    NutshellModal,
    NutshellIcon,
  ]
  // Only openUrl: the one thing a button may do besides opening a pop-up.
  const functions = [...basicCatalog.functions.values()].filter((fn) => fn.name === "openUrl")
  catalog = new Catalog(CATALOG_ID, basicCatalog.protocolVersion, components as never[], functions)
  return catalog
}

// Text in a block uses the same safe markdown as comments.
function BlockMarkdown({ markdown }: MarkdownComponentProps) {
  return <MarkdownView markdown={markdown} compact lineBreaks />
}

let nextSurface = 0

export default function A2uiBlockSurface({ block }: { block: A2uiBlock }) {
  const [surfaceId] = useState(() => `comment-block-${(nextSurface += 1)}`)
  // Rebuilt only when the block's content changes, not on every redraw: a rebuild resets the block,
  // so an open pop-up would close and the block would flicker on each board refresh.
  const content = JSON.stringify(block.components)
  const processor = useMemo(() => {
    const processor = new MessageProcessor([commentCatalog()])
    processor.processMessages([
      { version: "v0.9", createSurface: { surfaceId, catalogId: CATALOG_ID } },
      { version: "v0.9", updateComponents: { surfaceId, components: JSON.parse(content) } },
    ] as never)
    return processor
  }, [content, surfaceId])
  const [surface, setSurface] = useState(() => processor.model.surfacesMap.get(surfaceId) ?? null)

  useEffect(() => {
    const sync = () => setSurface(processor.model.surfacesMap.get(surfaceId) ?? null)
    sync()
    const created = processor.onSurfaceCreated(sync)
    const deleted = processor.onSurfaceDeleted(sync)
    return () => {
      created.unsubscribe()
      deleted.unsubscribe()
    }
  }, [processor, surfaceId])

  if (!surface) return null
  return (
    <MarkdownComponentContext.Provider value={BlockMarkdown}>
      {/* The basic components are web components, which the React renderer draws as elements; its types only list React ones. */}
      <A2uiSurface surface={surface as never} />
    </MarkdownComponentContext.Provider>
  )
}
