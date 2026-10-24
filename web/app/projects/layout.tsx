import { ProjectsProvider } from "@/components/projects/projects-store"

// Every page under /projects shares one store, so board changes survive
// moving between the project list, boards and tickets.
export default function ProjectsLayout({ children }: LayoutProps<"/projects">) {
  return <ProjectsProvider>{children}</ProjectsProvider>
}
