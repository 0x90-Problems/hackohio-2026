"use client"

import dynamic from "next/dynamic"
import { Component, type ReactNode } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { checkBlock, type A2uiBlock } from "@/lib/a2ui-block"

// The renderer loads only in the browser, and only when a comment has a block.
const Surface = dynamic(() => import("@/components/a2ui/a2ui-surface"), {
  ssr: false,
  loading: () => <Skeleton className="h-16 w-full rounded-lg" />,
})

/** A block that fails while rendering says so instead of breaking the comment list. */
class BlockBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? <BlockNotice text="This block couldn't be shown." /> : this.props.children
  }
}

function BlockNotice({ text }: { text: string }) {
  return <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">{text}</p>
}

/**
 * A comment's A2UI block (NSB-90), checked again here before rendering: the board checks it on
 * the way in, and this keeps an old or tampered copy from reaching the renderer.
 */
export function A2uiBlockView({ block, className }: { block: unknown; className?: string }) {
  let checked: A2uiBlock
  try {
    checked = checkBlock(block)
  } catch {
    return <BlockNotice text="This block can't be shown." />
  }
  return (
    <div className={["nutshell-a2ui", className].filter(Boolean).join(" ")}>
      <BlockBoundary>
        <Surface block={checked} />
      </BlockBoundary>
    </div>
  )
}
