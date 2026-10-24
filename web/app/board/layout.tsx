import type { Metadata } from "next"

import { BoardView } from "@/components/board/board-view"

export const metadata: Metadata = {
  title: "Board · buck2agents",
}

// The board lives in the layout, so it stays mounted (with its moves, categories
// and tags) while the URL switches between /board and /board/ticket/:id.
export default function BoardLayout({ children }: LayoutProps<"/board">) {
  return (
    <>
      <BoardView />
      {children}
    </>
  )
}
