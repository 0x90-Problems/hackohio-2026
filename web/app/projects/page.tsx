import type { Metadata } from "next"

import { ProjectsView } from "@/components/projects/projects-view"
import { pageTitle } from "@/lib/brand"

export const metadata: Metadata = {
  title: pageTitle("Projects"),
}

export default function ProjectsPage() {
  return <ProjectsView />
}
