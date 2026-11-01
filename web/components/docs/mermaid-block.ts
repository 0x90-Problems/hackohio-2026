import { Extension } from "@tiptap/core"
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state"
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view"

// A ```mermaid code block shows as its diagram; click it to edit the source. The block stays an
// ordinary code block in the document, so live editing, version diffs and agents all see text.

const MAX_SOURCE = 20_000
const results = new Map<string, Promise<string>>()
let queue: Promise<unknown> = Promise.resolve()
let count = 0

const isDark = () => document.documentElement.classList.contains("dark")

// Mermaid is large, so it only loads for documents that have a diagram.
function render(source: string): Promise<string> {
  const theme = isDark() ? "dark" : "neutral"
  const key = `${theme}|${source}`
  const known = results.get(key)
  if (known) return known
  if (results.size > 50) results.clear()
  // One at a time: mermaid's render isn't safe to run concurrently.
  const work = queue.then(async () => {
    const { default: mermaid } = await import("mermaid")
    // Document text is untrusted: strict mode sanitizes labels and turns off clicks and scripts.
    // Plain-text labels too, or an <img> in a label could load from anywhere (a tracking pixel).
    mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme, suppressErrorRendering: true, maxTextSize: MAX_SOURCE, htmlLabels: false, flowchart: { htmlLabels: false } })
    const { svg } = await mermaid.render(`nutshell-mermaid-${++count}`, source)
    return svg
  })
  queue = work.catch(() => undefined)
  results.set(key, work)
  return work
}

function widget(source: string, view: EditorView, getPos: () => number | undefined) {
  const box = document.createElement("div")
  box.className = "nutshell-mermaid"
  box.contentEditable = "false"
  box.setAttribute("role", "img")
  box.setAttribute("aria-label", "Diagram")
  if (view.editable) {
    box.title = "Click to edit this diagram"
    box.addEventListener("mousedown", (event) => {
      const pos = getPos()
      if (pos === undefined) return
      event.preventDefault()
      view.focus()
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos + 1)))
    })
  }
  const say = (text: string, error = false) => {
    const note = document.createElement("p")
    note.className = error ? "nutshell-mermaid-error" : "nutshell-mermaid-note"
    note.textContent = text
    box.replaceChildren(note)
  }
  if (!source.trim()) say("Empty diagram")
  else if (source.length > MAX_SOURCE) say("This diagram is too large to show.", true)
  else {
    say("Drawing diagram…")
    render(source).then(
      (svg) => {
        box.innerHTML = svg // sanitized by mermaid's strict mode
      },
      () => say("This diagram has a mistake. Click to fix it.", true)
    )
  }
  return box
}

export const MermaidBlock = Extension.create({
  name: "mermaidBlock",

  addProseMirrorPlugins() {
    const editor = this.editor
    return [
      new Plugin({
        key: new PluginKey("mermaidBlock"),
        props: {
          // Leaving or entering the editor changes which diagrams show their source.
          handleDOMEvents: {
            focus: (view) => {
              setTimeout(() => !view.isDestroyed && view.dispatch(view.state.tr), 0)
              return false
            },
            blur: (view) => {
              setTimeout(() => !view.isDestroyed && view.dispatch(view.state.tr), 0)
              return false
            },
          },
          decorations(state) {
            const decorations: Decoration[] = []
            const { from, to } = state.selection
            state.doc.descendants((node, pos) => {
              if (node.type.name !== "codeBlock") return true
              if (node.attrs.language !== "mermaid") return false
              const end = pos + node.nodeSize
              const source = node.textContent
              const editing = editor.isEditable && editor.isFocused && from > pos && to < end
              decorations.push(
                Decoration.widget(pos, (view, getPos) => widget(source, view, getPos), {
                  key: `mermaid|${isDark()}|${source}`,
                  side: -1,
                  ignoreSelection: true,
                  stopEvent: () => true,
                })
              )
              if (!editing) decorations.push(Decoration.node(pos, end, { class: "nutshell-mermaid-source" }))
              return false
            })
            return DecorationSet.create(state.doc, decorations)
          },
        },
      }),
    ]
  },
})

export const STARTER_DIAGRAM = "flowchart LR\n  A[Start] --> B[Finish]"
