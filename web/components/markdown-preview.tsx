import { type PreviewToken, previewTokens } from "@/lib/markdown-preview"
import { looksLikeMarkdown } from "@/lib/markdown-text"
import { cn } from "@/lib/utils"

// Markdown in feeds and search results: one flowing line of text with bold, italics, code and
// strikethrough kept and no block chrome, so `line-clamp` on the parent still works. Links show
// as underlined text, never as links, so the card around them keeps its click. No editor is
// loaded here, so a feed of many rows stays light.

export function MarkdownPreview({ markdown, className }: { markdown: string; className?: string }) {
  // Plain text (most older comments and chat) skips the parser.
  if (!looksLikeMarkdown(markdown)) return <span className={cn("break-words", className)}>{markdown}</span>
  return <PreviewTokens tokens={previewTokens(markdown)} className={className} />
}

export function PreviewTokens({ tokens, className }: { tokens: PreviewToken[]; className?: string }) {
  return (
    <span className={cn("break-words", className)}>
      {tokens.map((token, i) => (
        <PreviewPiece key={i} token={token} />
      ))}
    </span>
  )
}

function PreviewPiece({ token }: { token: PreviewToken }) {
  return token.marks.reduceRight<React.ReactNode>((inner, mark) => {
    switch (mark) {
      case "strong":
        return <strong className="font-semibold">{inner}</strong>
      case "em":
        return <em>{inner}</em>
      case "strike":
        return <s>{inner}</s>
      case "code":
        return <code className="rounded bg-muted px-1 font-mono text-[0.85em]">{inner}</code>
      case "link":
        return <span className="underline underline-offset-2">{inner}</span>
      case "hit":
        return <mark className="rounded-sm bg-muted px-0.5 font-semibold text-foreground">{inner}</mark>
    }
  }, token.text)
}
