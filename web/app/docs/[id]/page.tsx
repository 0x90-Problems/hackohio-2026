import type { Metadata } from "next"

import { DocumentView } from "@/components/docs/document-view"
import { pageTitle } from "@/lib/brand"

export const metadata: Metadata = {
  title: pageTitle("Document"),
}

export default async function DocumentPage({ params }: PageProps<"/docs/[id]">) {
  const { id } = await params
  return <DocumentView documentId={id} />
}
