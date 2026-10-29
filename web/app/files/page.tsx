import { Suspense } from "react"
import type { Metadata } from "next"

import { FilesView } from "@/components/files/files-view"
import { pageTitle } from "@/lib/brand"

export const metadata: Metadata = {
  title: pageTitle("Folders"),
}

// FilesView reads ?folder= from the URL, so it renders inside Suspense.
export default function FilesPage() {
  return (
    <Suspense>
      <FilesView />
    </Suspense>
  )
}
