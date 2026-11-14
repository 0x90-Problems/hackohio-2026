// Small markdown helpers for comments and chat. Dependency-free so node --test can load it.

// Anything a markdown renderer would change: emphasis, code, headings, quotes, lists, links, tables.
// Paired marks only, so ids like user_abc or a lone * don't count.
const SYNTAX = [
  /(\*\*|__|~~)\S/,
  /(^|\s)\*[^*\s][^*\n]*\*/,
  /(^|\s)_[^_\s][^_\n]*_(\s|$|[.,!?;:])/,
  /`[^`\n]+`/,
  /\[[^\]\n]*\]\(|\[\[/,
  /^\s{0,3}(#{1,6}\s|>|[-*+]\s|\d+[.)]\s|\|)/m,
  /^\s*```/m,
]

/** Plain text (most older comments and chat) needs no renderer at all. */
export function looksLikeMarkdown(text: string): boolean {
  return SYNTAX.some((pattern) => pattern.test(text))
}

/**
 * Written as chat and comments are, one Enter means a new line. Markdown would join those
 * lines into one paragraph, so each single line break becomes a hard break, except inside
 * code blocks and before lines that start a block of their own (lists, headings, quotes).
 */
export function withLineBreaks(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n")
  let fenced = false
  return lines
    .map((line, i) => {
      if (/^\s*```/.test(line)) fenced = !fenced
      const next = lines[i + 1]
      if (fenced || next === undefined || !line.trim() || !next.trim()) return line
      if (/^\s*```/.test(next) || /^\s{0,3}(#{1,6}\s|>|[-*+]\s|\d+[.)]\s|\|)/.test(next)) return line
      return /\\$|\s{2,}$/.test(line) ? line : `${line}\\`
    })
    .join("\n")
}

/** A one- or two-line snippet (feeds, notifications): the words without the markdown marks. */
export function plainSnippet(text: string, max = 400): string {
  return text
    .slice(0, max * 2)
    .replace(/```[^\n]*\n?/g, "")
    .replace(/!?\[([^\]\n]*)\]\([^)\n]*\)/g, "$1")
    .replace(/\[\[([^\]|\n]+)(\|[^\]\n]*)?\]\]/g, "$1")
    .replace(/^\s{0,3}(#{1,6}|[-*+] \[[ x]\]|[-*+]|>|\d+[.)])\s+/gm, "")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
}
