import type { Metadata } from "next"

import { ProjectsView } from "@/components/projects/projects-view"

export const metadata: Metadata = {
  title: "Projects · NutShell",
}

export default function ProjectsPage() {
  return <ProjectsView />
}
