// Markdown for one- or two-line previews (feeds, search results). Dependency-free so node --test
// can load it. Blocks are flattened into one line of text with marks; links become plain marked
// text, so a preview inside a clickable card never holds a link of its own.

export type PreviewMark = "strong" | "em" | "strike" | "code" | "link" | "hit"
export type PreviewToken = { text: string; marks: PreviewMark[] }

const INLINE = new RegExp(
  [
    /\\([\\`*_{}[\]()#+\-.!~|>])/.source, // 1: escaped character
    /(`+)([^`]+?)\2/.source, // 2, 3: code
    /\*\*(?=\S)(.+?)\*\*/.source, // 4: strong
    /__(?=\S)(.+?)__/.source, // 5: strong
    /~~(?=\S)(.+?)~~/.source, // 6: strike
    /!\[([^\]\n]*)\]\([^)\s]*\)/.source, // 7: image, alt text only
    /\[\[([^\]|\n]+)(?:\|([^\]\n]+))?\]\]/.source, // 8, 9: page link, label wins
    /\[([^\]\n]+)\]\([^)\s]+\)/.source, // 10: link text
    /(?<![\w*])\*(?=\S)([^*\n]+?)(?<=\S)\*(?![\w*])/.source, // 11: em
    /(?<![\w_])_(?=\S)([^_\n]+?)(?<=\S)_(?![\w_])/.source, // 12: em
  ].join("|")
)

function inline(text: string, marks: PreviewMark[]): PreviewToken[] {
  const out: PreviewToken[] = []
  let rest = text
  while (rest) {
    const m = INLINE.exec(rest)
    if (!m) {
      out.push({ text: rest, marks })
      break
    }
    if (m.index > 0) out.push({ text: rest.slice(0, m.index), marks })
    if (m[1] !== undefined) out.push({ text: m[1], marks })
    else if (m[3] !== undefined) out.push({ text: m[3], marks: [...marks, "code"] })
    else if (m[4] !== undefined || m[5] !== undefined) out.push(...inline(m[4] ?? m[5], [...marks, "strong"]))
    else if (m[6] !== undefined) out.push(...inline(m[6], [...marks, "strike"]))
    else if (m[7] !== undefined) out.push({ text: m[7], marks })
    else if (m[8] !== undefined) out.push({ text: (m[9] ?? m[8]).trim(), marks: [...marks, "link"] })
    else if (m[10] !== undefined) out.push(...inline(m[10], [...marks, "link"]))
    else out.push(...inline(m[11] ?? m[12], [...marks, "em"]))
    rest = rest.slice(m.index + m[0].length)
  }
  return out
}

/** The whole text as one line of marked tokens: headings bold, list items bulleted, code inline. */
export function previewTokens(markdown: string, max = 400): PreviewToken[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n")
  const blocks: PreviewToken[][] = []
  let fence: string[] | null = null
  for (const raw of lines) {
    if (/^\s*```/.test(raw)) {
      if (fence) {
        if (fence.length) blocks.push([{ text: fence.join(" "), marks: ["code"] }])
        fence = null
      } else fence = []
      continue
    }
    if (fence) {
      if (raw.trim()) fence.push(raw.trim())
      continue
    }
    let line = raw.trim()
    if (!line || /^(-{3,}|\*{3,}|_{3,})$/.test(line) || /^\|?[\s:|-]+\|[\s:|-]*$/.test(line)) continue
    line = line.replace(/^(>\s?)+/, "")
    const heading = /^#{1,6}\s+(.*)$/.exec(line)
    if (heading) {
      blocks.push(inline(heading[1], ["strong"]))
      continue
    }
    const task = /^[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(line)
    if (task) {
      blocks.push([{ text: task[1] === " " ? "☐ " : "☑ ", marks: [] }, ...inline(task[2], [])])
      continue
    }
    const item = /^([-*+]|\d+[.)])\s+(.*)$/.exec(line)
    if (item) {
      blocks.push([{ text: /\d/.test(item[1]) ? `${item[1]} ` : "• ", marks: [] }, ...inline(item[2], [])])
      continue
    }
    if (line.startsWith("|")) line = line.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()).join(" · ")
    blocks.push(inline(line, []))
  }
  if (fence?.length) blocks.push([{ text: fence.join(" "), marks: ["code"] }])

  const tokens: PreviewToken[] = []
  blocks.forEach((block, i) => {
    if (i > 0) tokens.push({ text: " ", marks: [] })
    tokens.push(...block)
  })
  return clip(tokens.filter((token) => token.text), 0, max, true)
}

/** The words a preview shows, without marks. */
export const previewText = (tokens: PreviewToken[]) => tokens.map((token) => token.text).join("")

// Tokens covering characters [start, end) of previewText, with ellipses where text was cut.
function clip(tokens: PreviewToken[], start: number, end: number, ellipsis: boolean): PreviewToken[] {
  const out: PreviewToken[] = []
  let at = 0
  for (const token of tokens) {
    const from = Math.max(start, at)
    const to = Math.min(end, at + token.text.length)
    if (to > from) out.push({ text: token.text.slice(from - at, to - at), marks: token.marks })
    at += token.text.length
  }
  if (ellipsis && start > 0) out.unshift({ text: "…", marks: [] })
  if (ellipsis && at > end) out.push({ text: "…", marks: [] })
  return out
}

/**
 * A window of text around the first match of `query`, with the match marked as a hit.
 * Null when the match isn't in the shown words (for example it's inside a link address);
 * the caller then shows the plain text instead.
 */
export function highlightTokens(tokens: PreviewToken[], query: string, width = 90, lead = 30): PreviewToken[] | null {
  const q = query.trim().toLowerCase()
  if (!q) return null
  const text = previewText(tokens)
  const at = text.toLowerCase().indexOf(q)
  if (at < 0) return null
  const start = Math.max(0, at - lead)
  const windowed = clip(tokens, start, start + width, false)
  const out: PreviewToken[] = start > 0 ? [{ text: "…", marks: [] }] : []
  let pos = start
  for (const token of windowed) {
    const hitFrom = Math.max(at, pos) - pos
    const hitTo = Math.min(at + q.length, pos + token.text.length) - pos
    if (hitTo > hitFrom) {
      if (hitFrom > 0) out.push({ text: token.text.slice(0, hitFrom), marks: token.marks })
      out.push({ text: token.text.slice(hitFrom, hitTo), marks: [...token.marks, "hit"] })
      if (hitTo < token.text.length) out.push({ text: token.text.slice(hitTo), marks: token.marks })
    } else out.push(token)
    pos += token.text.length
  }
  if (text.length > start + width) out.push({ text: "…", marks: [] })
  return out
}
