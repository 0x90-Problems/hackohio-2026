"use client"

import { type Editor, useEditorState } from "@tiptap/react"

import {
  BoldIcon,
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  Link2Icon,
  LinkIcon,
  ListChecksIcon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  QuoteIcon,
  ScissorsLineDashedIcon,
  Redo2Icon,
  SquareCodeIcon,
  WorkflowIcon,
  StrikethroughIcon,
  Undo2Icon,
} from "@/components/icons"
import { STARTER_DIAGRAM } from "@/components/docs/mermaid-block"
import { cn } from "@/lib/utils"

type Tool = {
  label: string
  keys?: string
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
  active?: (e: Editor) => boolean
  run: (e: Editor) => void
}

const GROUPS: Tool[][] = [
  [
    { label: "Undo", keys: "Ctrl+Z", icon: Undo2Icon, run: (e) => e.chain().focus().undo().run() },
    { label: "Redo", keys: "Ctrl+Shift+Z", icon: Redo2Icon, run: (e) => e.chain().focus().redo().run() },
  ],
  [
    { label: "Heading 1", keys: "#", icon: Heading1Icon, active: (e) => e.isActive("heading", { level: 1 }), run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
    { label: "Heading 2", keys: "##", icon: Heading2Icon, active: (e) => e.isActive("heading", { level: 2 }), run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: "Heading 3", keys: "###", icon: Heading3Icon, active: (e) => e.isActive("heading", { level: 3 }), run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  ],
  [
    { label: "Bold", keys: "Ctrl+B", icon: BoldIcon, active: (e) => e.isActive("bold"), run: (e) => e.chain().focus().toggleBold().run() },
    { label: "Italic", keys: "Ctrl+I", icon: ItalicIcon, active: (e) => e.isActive("italic"), run: (e) => e.chain().focus().toggleItalic().run() },
    { label: "Strikethrough", keys: "Ctrl+Shift+S", icon: StrikethroughIcon, active: (e) => e.isActive("strike"), run: (e) => e.chain().focus().toggleStrike().run() },
    { label: "Inline code", keys: "`", icon: CodeIcon, active: (e) => e.isActive("code"), run: (e) => e.chain().focus().toggleCode().run() },
    {
      label: "Link",
      keys: "https only",
      icon: LinkIcon,
      active: (e) => e.isActive("link"),
      run: (e) => {
        if (e.isActive("link")) return void e.chain().focus().unsetLink().run()
        const url = window.prompt("Link address (https://…)")?.trim()
        if (!url) return
        if (!url.startsWith("https://")) return void window.alert("Links must start with https://")
        e.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
      },
    },
    { label: "Link to a page", keys: "[[", icon: Link2Icon, run: (e) => e.chain().focus().insertContent("[[").run() },
  ],
  [
    { label: "Bulleted list", keys: "-", icon: ListIcon, active: (e) => e.isActive("bulletList"), run: (e) => e.chain().focus().toggleBulletList().run() },
    { label: "Numbered list", keys: "1.", icon: ListOrderedIcon, active: (e) => e.isActive("orderedList"), run: (e) => e.chain().focus().toggleOrderedList().run() },
    { label: "Checklist", keys: "[ ]", icon: ListChecksIcon, active: (e) => e.isActive("taskList"), run: (e) => e.chain().focus().toggleTaskList().run() },
  ],
  [
    { label: "Quote", keys: ">", icon: QuoteIcon, active: (e) => e.isActive("blockquote"), run: (e) => e.chain().focus().toggleBlockquote().run() },
    { label: "Code block", keys: "```", icon: SquareCodeIcon, active: (e) => e.isActive("codeBlock"), run: (e) => e.chain().focus().toggleCodeBlock().run() },
    {
      label: "Diagram",
      keys: "```mermaid",
      icon: WorkflowIcon,
      run: (e) => e.chain().focus().insertContent({ type: "codeBlock", attrs: { language: "mermaid" }, content: [{ type: "text", text: STARTER_DIAGRAM }] }).run(),
    },
    { label: "Divider", keys: "---", icon: MinusIcon, run: (e) => e.chain().focus().setHorizontalRule().run() },
    { label: "Page break", icon: ScissorsLineDashedIcon, run: (e) => e.chain().focus().insertContent([{ type: "pageBreak" }, { type: "paragraph" }]).run() },
  ],
]

const ALL = GROUPS.flat()

// Formatting buttons above the document. Each shows its typed shortcut in the tooltip.
export function EditorToolbar({ editor, disabled }: { editor: Editor; disabled?: boolean }) {
  // Re-render only when what's active under the cursor changes.
  const active = useEditorState({ editor, selector: ({ editor: e }) => ALL.map((tool) => Boolean(tool.active?.(e))) })
  let index = 0
  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="sticky top-0 z-10 flex flex-wrap items-center gap-1 rounded-lg border bg-background/95 p-1 backdrop-blur"
    >
      {GROUPS.map((group, g) => (
        <div key={g} className={cn("flex items-center gap-0.5", g > 0 && "border-l pl-1")}>
          {group.map((tool) => {
            const pressed = active[index++]
            const Icon = tool.icon
            return (
              <button
                key={tool.label}
                type="button"
                title={tool.keys ? `${tool.label} (${tool.keys})` : tool.label}
                aria-label={tool.label}
                aria-pressed={tool.active ? pressed : undefined}
                disabled={disabled}
                onMouseDown={(event) => event.preventDefault()} // keep the text selection
                onClick={() => tool.run(editor)}
                className={cn(
                  "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-40",
                  pressed && "bg-muted text-foreground"
                )}
              >
                <Icon className="size-4" aria-hidden />
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
