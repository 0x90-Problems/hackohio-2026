"use client"

import { useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { PlusIcon } from "lucide-react"

import { ACTOR_TYPES, TICKET_STATUS } from "@/shared/names"
import type { Project } from "@/lib/types"
import { TEAM } from "@/lib/mock-data"
import { CATEGORY_COLORS } from "@/lib/categories"
import { timeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"
import { projectKeyOf, useProjects } from "@/components/projects/projects-store"
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
  DialogClose,
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
  const [team, setTeam] = useState(TEAM)
  const shown = projects.filter((p) => p.team === team)

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
        <div className="flex items-center gap-3">
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

// "PITCH DEMO" -> "PD", "HackOHI/O build" -> "HB". Users can change it.
const suggestKey = (name: string) =>
  name
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 4)

function NewProjectDialog({ defaultTeam }: { defaultTeam: string }) {
  const { projects, createProject } = useProjects()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [key, setKey] = useState("")
  const [keyEdited, setKeyEdited] = useState(false)
  const [description, setDescription] = useState("")
  const [team, setTeam] = useState(defaultTeam)

  const finalKey = keyEdited ? key : suggestKey(name)
  const keyTaken = projects.some((p) => p.key === finalKey)
  const keyValid = /^[A-Z][A-Z0-9]{1,5}$/.test(finalKey)
  const canSubmit = name.trim() && keyValid && !keyTaken

  function reset() {
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
    })
    reset()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon data-icon="inline-start" />
          New project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>
              It gets its own board with Backlog, In progress, In review and
              Done.
            </DialogDescription>
          </DialogHeader>
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
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!canSubmit}>
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
