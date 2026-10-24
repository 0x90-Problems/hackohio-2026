import { redirect } from "next/navigation"

// /projects/CLW opens that project's board
export default async function ProjectPage({
  params,
}: PageProps<"/projects/[key]">) {
  const { key } = await params
  redirect(`/projects/${key}/board`)
}
