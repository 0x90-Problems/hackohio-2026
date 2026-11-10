// Which uploaded files are markdown, so previews show them formatted. Dependency-free for node --test.

const EXTENSIONS = [".md", ".markdown", ".mdown"]

/** Browsers often upload .md files as text/plain or with no type at all, so the name counts too. */
export function isMarkdownFile(node: { name: string; content_type?: string }): boolean {
  const type = (node.content_type ?? "").split(";")[0].trim().toLowerCase()
  if (type === "text/markdown" || type === "text/x-markdown") return true
  if (type && type !== "text/plain" && type !== "application/octet-stream") return false
  const name = node.name.toLowerCase()
  return EXTENSIONS.some((ext) => name.endsWith(ext))
}
