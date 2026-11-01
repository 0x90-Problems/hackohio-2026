import { type Editor, Extension, InputRule, Node } from "@tiptap/core"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view"

// [[Page name]], saved as [[Page name|nte_id]] once we know which page it is: the id keeps
// the link working through a rename, and plain markdown readers (agents, diffs) still see the name.
const PAGE_LINK = /^\[\[([^[\]|\n]{1,120})(?:\|(nte_[A-Za-z0-9]+))?\]\]/

export const PageLink = Node.create({
  name: "pageLink",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      id: { default: null, parseHTML: (el) => el.getAttribute("data-page-id") },
      name: { default: "", parseHTML: (el) => el.getAttribute("data-page-name") ?? el.textContent ?? "" },
    }
  },

  parseHTML() {
    return [{ tag: "a[data-page-link]" }]
  },

  renderHTML({ node }) {
    const { id, name } = node.attrs as { id: string | null; name: string }
    return [
      "a",
      {
        "data-page-link": "",
        "data-page-name": name,
        ...(id ? { "data-page-id": id } : {}),
        href: id ? `/docs/${encodeURIComponent(id)}` : "#",
        class: id ? "nutshell-page-link" : "nutshell-page-link nutshell-page-link-missing",
        title: id ? undefined : `Create the page “${name}”`,
      },
      name,
    ]
  },

  addInputRules() {
    const type = this.type
    return [
      // Typing the closing ]] turns the whole thing into a link, brackets included.
      new InputRule({
        find: /\[\[([^[\]|\n]{1,120})\]\]$/,
        handler: ({ state, range, match }) => {
          state.tr.replaceWith(range.from, range.to, type.create({ id: null, name: match[1].trim() }))
        },
      }),
    ]
  },

  markdownTokenName: "pageLink",
  markdownTokenizer: {
    name: "pageLink",
    level: "inline",
    start: (src) => src.indexOf("[["),
    tokenize(src) {
      const match = PAGE_LINK.exec(src)
      if (!match) return undefined
      return { type: "pageLink", raw: match[0], text: match[1].trim(), pageId: match[2] }
    },
  },
  parseMarkdown: (token, helpers) => helpers.createNode("pageLink", { name: token.text, id: token.pageId ?? null }),
  renderMarkdown: (node) => {
    // A name can't close the link early when it's read back.
    const name = String(node.attrs?.name ?? "").replace(/[[\]|\n]/g, " ").trim()
    const id = node.attrs?.id
    return `[[${name}${id ? `|${id}` : ""}]]`
  },
})

const PAGE_BREAK_MARKDOWN = "<!-- pagebreak -->"

// A manual page break. In markdown it's a comment, so other readers simply skip it.
export const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,

  parseHTML() {
    return [{ tag: "div[data-page-break]" }]
  },

  renderHTML() {
    return ["div", { "data-page-break": "", class: "nutshell-page-break" }, "Page break"]
  },

  markdownTokenName: "pageBreak",
  markdownTokenizer: {
    name: "pageBreak",
    level: "block",
    start: (src) => src.indexOf(PAGE_BREAK_MARKDOWN),
    tokenize(src) {
      const match = /^<!-- pagebreak -->[^\S\n]*(?:\n+|$)/.exec(src)
      return match ? { type: "pageBreak", raw: match[0] } : undefined
    },
  },
  parseMarkdown: (_token, helpers) => helpers.createNode("pageBreak"),
  renderMarkdown: () => PAGE_BREAK_MARKDOWN,
})

// -- paper view: starts each block on the right sheet ------------------------------------

export type PaperLayout = {
  contentHeight: number // the writable height of one sheet
  gap: number // from the bottom of one sheet's writing to the top of the next one's
  onPages: (pages: number) => void
}

type PaperStorage = { layout: PaperLayout | null }
const paperKey = new PluginKey<DecorationSet>("paperPages")

/** Where each sheet's blocks go. Blocks stay whole unless one is taller than a sheet. */
function measure(view: EditorView, layout: PaperLayout) {
  const period = layout.contentHeight + layout.gap
  const starts: { from: number; to: number; push: number }[] = []
  let y = 0
  let page = 0
  let forced = false
  let first = true
  view.state.doc.forEach((node, offset) => {
    const dom = view.nodeDOM(offset)
    if (!(dom instanceof HTMLElement)) return
    if (node.type.name === "pageBreak") {
      forced = true
      return
    }
    const started = dom.classList.contains("nutshell-page-start")
    const margin = first || started ? 0 : Number.parseFloat(getComputedStyle(dom).marginTop) || 0
    const height = dom.getBoundingClientRect().height
    const top = y + margin
    const startsSheet = y === page * period
    if (forced || (top + height > page * period + layout.contentHeight && !startsSheet)) {
      page += 1
      starts.push({ from: offset, to: offset + node.nodeSize, push: page * period - y })
      y = page * period + height
      forced = false
    } else {
      y = top + height
    }
    // A block taller than a sheet runs on; carry on from the sheet it ends on.
    page = Math.max(page, Math.floor(Math.max(y - 1, 0) / period))
    first = false
  })
  if (forced) page += 1 // a break at the very end starts an empty sheet
  return { starts, pages: page + 1 }
}

export const PaperPages = Extension.create<object, PaperStorage>({
  name: "paperPages",

  addStorage() {
    return { layout: null }
  },

  addProseMirrorPlugins() {
    const storage = this.storage
    return [
      new Plugin<DecorationSet>({
        key: paperKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            const next = tr.getMeta(paperKey) as DecorationSet | undefined
            return next ?? set.map(tr.mapping, tr.doc)
          },
        },
        props: {
          decorations: (state) => paperKey.getState(state),
        },
        view(view) {
          let frame = 0
          let applied = ""
          let lastLayout = storage.layout
          const run = () => {
            const layout = storage.layout
            const result = layout ? measure(view, layout) : { starts: [], pages: 1 }
            const signature = result.starts.map((s) => `${s.from}:${Math.round(s.push)}`).join()
            if (signature !== applied) {
              applied = signature
              const set = DecorationSet.create(
                view.state.doc,
                result.starts.map((s) =>
                  Decoration.node(s.from, s.to, { class: "nutshell-page-start", style: `--nutshell-page-push: ${s.push}px` })
                )
              )
              view.dispatch(view.state.tr.setMeta(paperKey, set).setMeta("addToHistory", false))
            }
            layout?.onPages(result.pages)
          }
          const schedule = () => {
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(run)
          }
          const resized = new ResizeObserver(schedule)
          resized.observe(view.dom)
          schedule()
          return {
            update(updated, previous) {
              if (storage.layout !== lastLayout || !previous.doc.eq(updated.state.doc)) {
                lastLayout = storage.layout
                schedule()
              }
            },
            destroy() {
              cancelAnimationFrame(frame)
              resized.disconnect()
            },
          }
        },
      }),
    ]
  },
})

export function setPaperLayout(editor: Editor, layout: PaperLayout | null) {
  const storage = (editor.storage as unknown as { paperPages: PaperStorage }).paperPages
  storage.layout = layout
  if (!editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta("addToHistory", false))
}
