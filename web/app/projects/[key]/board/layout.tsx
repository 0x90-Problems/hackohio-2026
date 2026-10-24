import type { Metadata } from "next"

import { projects } from "@/lib/mock-data"
import { BoardView } from "@/components/board/board-view"

export async function generateMetadata({
  params,
}: LayoutProps<"/projects/[key]/board">): Promise<Metadata> {
  const { key } = await params
  const name = projects.find((p) => p.key === key)?.name ?? key
  return { title: `${name} · buck2agents` }
}

// The board lives in the layout, so it stays mounted (with its moves, categories
// and tags) while the URL switches between the board and /ticket/:id.
export default async function BoardLayout({
  params,
  children,
}: LayoutProps<"/projects/[key]/board">) {
  const { key } = await params
  return (
    <>
      <BoardView projectKey={key} />
      {children}
    </>
  )
}
