import type { Metadata } from "next"

import { BoardsView } from "@/components/whiteboard/boards-view"
import { pageTitle } from "@/lib/brand"

export const metadata: Metadata = {
  title: pageTitle("Whiteboards"),
}

export default function BoardsPage() {
  return <BoardsView />
}
