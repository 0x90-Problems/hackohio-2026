"use client"

import { useEffect } from "react"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { Markdown } from "@tiptap/markdown"
import { TaskItem, TaskList } from "@tiptap/extension-list"

import { PageBreak, PageLink } from "@/components/docs/doc-extensions"
import { MermaidBlock } from "@/components/docs/mermaid-block"
import { looksLikeMarkdown, withLineBreaks } from "@/lib/markdown-text"
import { MarkdownPreview } from "@/components/markdown-preview"
import { cn } from "@/lib/utils"

// Markdown shown read-only: comments, document previews, .md files. It goes through the same
// editor schema as Documents, so only known blocks and marks come out; raw HTML is never rendered,
// and links are https or http only (no javascript: or data:).

export function markdownExtensions(links: { openOnClick: boolean }) {
  return [
    StarterKit.configure({ undoRedo: false, link: { openOnClick: links.openOnClick, autolink: true, protocols: ["https", "http"], HTMLAttributes: { target: "_blank", rel: "noopener noreferrer nofollow" } } }),
    TaskList,
    TaskItem.configure({ nested: true }),
    PageLink,
    PageBreak,
    MermaidBlock,
    Markdown,
  ]
}

/**
 * `compact` is the comment size: body text at text-sm, headings only a little larger.
 * `lineBreaks` is for what people type as messages (comments, chat): one Enter is a new line,
 * and plain text with no markdown in it skips the renderer altogether.
 * `preview` is the one-line form for feeds and search results (see MarkdownPreview).
 */
export function MarkdownView({ markdown, compact = false, lineBreaks = false, preview = false, className }: { markdown: string; compact?: boolean; lineBreaks?: boolean; preview?: boolean; className?: string }) {
  if (preview) return <MarkdownPreview markdown={markdown} className={className} />
  const plain = lineBreaks && !looksLikeMarkdown(markdown)
  if (plain) return <p className={cn("break-words whitespace-pre-wrap", compact && "text-sm", className)}>{markdown}</p>
  return <RenderedMarkdown markdown={lineBreaks ? withLineBreaks(markdown) : markdown} compact={compact} className={className} />
}

function RenderedMarkdown({ markdown, compact, className }: { markdown: string; compact: boolean; className?: string }) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: markdownExtensions({ openOnClick: true }),
    content: markdown,
    contentType: "markdown",
    editorProps: { attributes: { class: cn("nutshell-doc nutshell-markdown", compact && "nutshell-markdown-compact") } },
  })

  useEffect(() => {
    if (editor && !editor.isDestroyed && editor.getMarkdown() !== markdown) editor.commands.setContent(markdown, { contentType: "markdown" })
  }, [editor, markdown])

  // Until the editor is ready, the plain text, so nothing jumps or goes blank.
  if (!editor) return <div className={cn("break-words whitespace-pre-wrap", compact ? "text-sm" : "", className)}>{markdown}</div>
  return <EditorContent editor={editor} className={cn("min-w-0 break-words", className)} />
}
