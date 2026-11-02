// Images on boards and what a board saves into its folder. No editor or network code in here.

// A board's image element holds the id of a Files node, never image data. The server refuses anything else.
const FILE_REF = /^fil_[A-Za-z0-9]{1,64}$/

export function isFileRef(fileId: unknown): fileId is string {
  return typeof fileId === "string" && FILE_REF.test(fileId)
}

// Formats that can't carry script. SVG isn't here: a user's SVG is never drawn on a board.
const RASTER: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" }
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // everyone who opens the board downloads it

export function isRaster(type: string) {
  return type in RASTER
}

/** Why this file can't go on a board, in words for a person. Null when it can. */
export function imageProblem(file: { type: string; size: number }): string | null {
  if (!isRaster(file.type)) return "Boards take PNG, JPEG, GIF and WebP images."
  if (file.size > MAX_IMAGE_BYTES) return "That image is too large. Boards take images up to 10 MB."
  return null
}

// Names are limited to 255 characters, and the folder name key is shared with other files.
const safeName = (boardName: string) => boardName.trim().slice(0, 150) || "Whiteboard"

export function imageFileName(boardName: string, type: string, tag: string) {
  return `${safeName(boardName)} image ${tag}.${RASTER[type] ?? "png"}`
}

export function exportFileName(boardName: string, kind: "png" | "svg", at: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  const stamp = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}${pad(at.getMinutes())}`
  return `${safeName(boardName)} ${stamp}.${kind}`
}

export function versionFileName(boardName: string, version: number) {
  return `${safeName(boardName)} v${version}.excalidraw`
}

export type LoadedImage = { id: string; mimeType: string; dataURL: string; created: number }

const MAX_LOADING = 3 // every image starts with a call to Files, and the account's concurrency is small
const RETRY_MS = 30_000
const MAX_TRIES = 3

/** Fetches board images a few at a time. A file someone can't read stays a placeholder; nothing keeps asking. */
export class ImageLoader {
  private queue: string[] = []
  private state = new Map<string, { tries: number; done: boolean }>()
  private active = 0
  private idle: (() => void)[] = []
  private retries = new Set<ReturnType<typeof setTimeout>>()
  private stopped = false
  private readonly fetchOne: (id: string) => Promise<LoadedImage>
  private readonly onLoaded: (image: LoadedImage) => void
  private readonly retryMs: number

  constructor(fetchOne: (id: string) => Promise<LoadedImage>, onLoaded: (image: LoadedImage) => void, retryMs = RETRY_MS) {
    this.fetchOne = fetchOne
    this.onLoaded = onLoaded
    this.retryMs = retryMs
  }

  /** Ask for these images. Anything already loaded, loading or given up on is ignored. */
  need(ids: Iterable<string>) {
    for (const id of ids) {
      if (!isFileRef(id) || this.state.has(id)) continue
      this.state.set(id, { tries: 0, done: false })
      this.queue.push(id)
    }
    this.pump()
  }

  /** Something else has this one (the person who just uploaded it). */
  have(id: string) {
    this.state.set(id, { tries: 0, done: true })
    this.queue = this.queue.filter((queued) => queued !== id)
  }

  /** Resolves when nothing is loading or waiting, so an export has every image it can get. */
  settled(): Promise<void> {
    if (!this.active && !this.queue.length) return Promise.resolve()
    return new Promise((resolve) => this.idle.push(resolve))
  }

  stop() {
    this.stopped = true
    this.queue = []
    for (const timer of this.retries) clearTimeout(timer)
    this.retries.clear()
    this.wake()
  }

  private wake() {
    if (this.active || this.queue.length) return
    for (const resolve of this.idle.splice(0)) resolve()
  }

  private pump() {
    while (!this.stopped && this.active < MAX_LOADING && this.queue.length) {
      const id = this.queue.shift() as string
      this.active++
      void this.load(id)
    }
    this.wake()
  }

  private async load(id: string) {
    const entry = this.state.get(id) ?? { tries: 0, done: false }
    entry.tries++
    try {
      const image = await this.fetchOne(id)
      entry.done = true
      if (!this.stopped) this.onLoaded(image)
    } catch (error) {
      const status = (error as { status?: number }).status
      const forGood = status === 403 || status === 404 || status === 415
      if (!forGood && entry.tries < MAX_TRIES && !this.stopped) {
        const timer = setTimeout(() => {
          this.retries.delete(timer)
          this.queue.push(id)
          this.pump()
        }, this.retryMs)
        this.retries.add(timer)
      }
    } finally {
      this.active--
      this.pump()
    }
  }
}
