import type { Metadata } from "next"

// /projects/CLW/board/ticket/CLW-05: the layout's board opens this ticket's side panel.
export async function generateMetadata({
  params,
}: PageProps<"/projects/[key]/board/ticket/[id]">): Promise<Metadata> {
  const { id } = await params
  return { title: decodeURIComponent(id) }
}

export default function TicketPage() {
  return null
}
