"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import { PlusIcon } from "@/components/icons"

import { ACTOR_TYPES, TICKET_STATUS } from "@/shared/names"
import type { Project } from "@/lib/types"
import { TEAM } from "@/lib/mock-data"
import { CATEGORY_COLORS } from "@/lib/categories"
import { timeAgo } from "@/lib/format"
import {
  PICKER_DESCRIPTION,
  PICKER_TITLE,
  PROJECT_TEMPLATES,
  type ProjectTemplate,
} from "@/lib/templates"
import { cn } from "@/lib/utils"
import { ProjectActions } from "@/components/projects/project-actions"
import { TemplatePreview } from "@/components/projects/template-preview"
import { projectKeyOf, useProjects } from "@/components/projects/projects-store"
import { SearchCombobox } from "@/components/search-combobox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

// Teams a project can belong to. Only one until teams come from the database.
const TEAMS = [TEAM]

// Like a GitHub org's repo list: one card per project, each opening its board.
export function ProjectsView() {
  const { projects } = useProjects()
  const router = useRouter()
  const [team, setTeam] = useState(TEAM)
  const shown = projects.filter((p) => p.team === team && !p.archived)
  const archived = projects.filter((p) => p.team === team && p.archived)

  return (
    <main className="mx-auto flex max-w-screen-xl flex-col gap-6 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
            {team}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Each project has its own board, columns, tags and tickets.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {TEAMS.length > 1 && (
            <Select value={team} onValueChange={setTeam}>
              <SelectTrigger aria-label="Team">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEAMS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <SearchCombobox
            label="Search projects…"
            searchPlaceholder="Project name or key"
            emptyText="No project found."
            align="end"
            groups={[
              {
                heading: team,
                items: [...shown, ...archived].map((p) => ({
                  value: p.key,
                  keywords: [p.name, p.description ?? ""],
                  label: (
                    <>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {p.key}
                      </span>
                      <span className="truncate">{p.archived ? `${p.name} (archived)` : p.name}</span>
                    </>
                  ),
                  onSelect: () => router.push(`/projects/${p.key}/board`),
                })),
              },
            ]}
          />
          <NewProjectDialog defaultTeam={team} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence initial={true}>
          {shown.map((project, index) => (
            <ProjectCard key={project.key} project={project} index={index} />
          ))}
        </AnimatePresence>
      </div>
    </main>
  )
}

function ProjectCard({ project, index }: { project: Project; index: number }) {
  const store = useProjects()
  const categories = store.categoriesOf(project.key)
  const tickets = store.tickets.filter(
    (t) => projectKeyOf(t.key) === project.key
  )
  // "Done" is the shared done column, or the last column if that was deleted
  const doneSlug = categories.some((c) => c.slug === TICKET_STATUS.DONE)
    ? TICKET_STATUS.DONE
    : categories.at(-1)?.slug
  const done = tickets.filter((t) => t.status === doneSlug).length
  const byAgents = tickets.filter(
    (t) => t.created_by.type === ACTOR_TYPES.AGENT
  ).length
  const isNew = store.newProjectKeys.has(project.key)

  return (
    // Cards fade up one after another; a new project pops in. They lift on hover.
    <motion.div
      layout
      initial={isNew ? { opacity: 0, scale: 0.9 } : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 28,
        delay: isNew ? 0 : index * 0.06,
      }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.99 }}
    >
      <Link
        href={`/projects/${project.key}/board`}
        className="block rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Card className="h-full transition-shadow duration-200 hover:shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono">
                {project.key}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {timeAgo(project.created_at) === "just now"
                  ? "created just now"
                  : `created ${timeAgo(project.created_at)} ago`}
              </span>
            </div>
            <CardTitle className="text-lg">{project.name}</CardTitle>
            {project.description && (
              <CardDescription>{project.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {/* One segment per column, sized by how many tickets it has */}
            <div className="flex h-2 overflow-hidden rounded-full bg-muted">
              {tickets.length > 0 &&
                categories.map((c) => {
                  const count = tickets.filter(
                    (t) => t.status === c.slug
                  ).length
                  return (
                    <motion.span
                      key={c.slug}
                      className={cn("h-full", CATEGORY_COLORS[c.color].dot)}
                      initial={{ width: 0 }}
                      animate={{ width: `${(count / tickets.length) * 100}%` }}
                      transition={{
                        duration: 0.6,
                        ease: "easeOut",
                        delay: 0.2 + index * 0.06,
                      }}
                    />
                  )
                })}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {categories.map((c) => (
                <span key={c.slug} className="inline-flex items-center gap-1">
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      CATEGORY_COLORS[c.color].dot
                    )}
                  />
                  {c.name} {tickets.filter((t) => t.status === c.slug).length}
                </span>
              ))}
            </div>
          </CardContent>
          <CardFooter className="justify-between text-sm text-muted-foreground">
            <span>
              {done} of {tickets.length} done
            </span>
            <span>{byAgents} by agents</span>
          </CardFooter>
        </Card>
      </Link>
    </motion.div>
  )
}

// "Pitch demo" -> "PD", "Bugs" -> "BUG". Users can change it.
function suggestKey(name: string) {
  const words = name.split(/[^A-Za-z0-9]+/).filter(Boolean)
  const key = words.length === 1 ? words[0].slice(0, 3) : words.map((w) => w[0]).join("")
  return key.toUpperCase().slice(0, 4)
}

function NewProjectDialog({ defaultTeam }: { defaultTeam: string }) {
  const { projects, createProject } = useProjects()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  // Step 1 picks a template, step 2 fills in the details
  const [template, setTemplate] = useState<ProjectTemplate | null>(null)
  const [name, setName] = useState("")
  const [key, setKey] = useState("")
  const [keyEdited, setKeyEdited] = useState(false)
  const [description, setDescription] = useState("")
  const [team, setTeam] = useState(defaultTeam)

  const finalKey = keyEdited ? key : suggestKey(name)
  const keyTaken = projects.some((p) => p.key === finalKey)
  const keyValid = /^[A-Z][A-Z0-9]{1,5}$/.test(finalKey)
  const canSubmit = template && name.trim() && keyValid && !keyTaken

  function reset() {
    setTemplate(null)
    setName("")
    setKey("")
    setKeyEdited(false)
    setDescription("")
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    createProject({
      name: name.trim(),
      key: finalKey,
      ...(description.trim() && { description: description.trim() }),
      team,
      template,
    })
    reset()
    setOpen(false)
    router.push(`/projects/${finalKey}/board`)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <PlusIcon data-icon="inline-start" aria-hidden="true" />
          New project
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100svh-2rem)] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-[calc(100vw-2rem)]">
        {!template ? (
          <>
            <DialogHeader>
              <DialogTitle>{PICKER_TITLE}</DialogTitle>
              <DialogDescription>{PICKER_DESCRIPTION}</DialogDescription>
            </DialogHeader>
            <div className="grid items-stretch gap-6 2xl:grid-cols-2">
              {PROJECT_TEMPLATES.map((t, index) => (
                <motion.button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplate(t)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.03 }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex h-full flex-col gap-4 rounded-2xl border p-5 text-left transition-colors hover:border-foreground/30 hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <TemplatePreview template={t} />
                  <span className="text-base font-semibold">{t.name}</span>
                  <span className="text-sm text-muted-foreground">{t.description}</span>
                </motion.button>
              ))}
            </div>
          </>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>
                New {template.name.toLowerCase()} project
              </DialogTitle>
              <DialogDescription>{template.description}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 rounded-2xl border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Board columns
                </span>
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  onClick={() => setTemplate(null)}
                >
                  Change template
                </Button>
              </div>
              <TemplatePreview template={template} />
              {template.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="mr-1 text-xs text-muted-foreground">
                    Starter tags
                  </span>
                  {template.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="font-normal"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-name">Name</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Mobile app"
                autoFocus
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-key">Key</Label>
              <Input
                id="project-key"
                value={finalKey}
                onChange={(e) => {
                  setKeyEdited(true)
                  setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
                }}
                placeholder="MA"
                className="font-mono uppercase"
                aria-invalid={!!finalKey && (!keyValid || keyTaken)}
              />
              <p
                className={cn(
                  "text-xs text-muted-foreground",
                  keyTaken && "text-destructive"
                )}
              >
                {keyTaken
                  ? `${finalKey} is already used by another project.`
                  : `Ticket ids start with this: ${finalKey || "KEY"}-01. 2–6 letters or numbers.`}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-description">Description</Label>
              <Textarea
                id="project-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this project for? (optional)"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-team">Team</Label>
              <Select value={team} onValueChange={setTeam}>
                <SelectTrigger id="project-team" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEAMS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setTemplate(null)}
              >
                Back
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                Create project
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
