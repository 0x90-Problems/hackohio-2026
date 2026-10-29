import type { Metadata } from "next"

import { BoardView } from "@/components/whiteboard/board-view"
import { pageTitle } from "@/lib/brand"

export const metadata: Metadata = {
  title: pageTitle("Whiteboard"),
}

export default async function BoardPage({ params }: PageProps<"/boards/[id]">) {
  const { id } = await params
  return <BoardView boardId={id} />
}
