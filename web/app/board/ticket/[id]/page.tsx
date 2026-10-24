import { redirect } from "next/navigation"

// Old address: /board/ticket/CLW-05 -> /projects/CLW/board/ticket/CLW-05
export default async function OldTicketPage({
  params,
}: PageProps<"/board/ticket/[id]">) {
  const { id } = await params
  redirect(`/projects/${id.split("-")[0]}/board/ticket/${id}`)
}
