// Asks the server whether this board is due an autosave. The server decides and picks one browser,
// so this only has to ask rarely: a while after someone edits, then when the server says it's due.
// A tab nobody is editing in asks once, when it opens, to catch a board left unsaved.

export type AutosaveReply = { saved: boolean; dirty?: boolean; due_in?: number; version?: number }

const AFTER_EDIT_MS = 30_000
const AFTER_FAILURE_MS = 60_000
const JITTER_MS = 30_000 // so several tabs don't all ask in the same instant

export class Autosaver {
  private timer: ReturnType<typeof setTimeout> | null = null
  private asking = false
  private editedWhileAsking = false
  private stopped = false
  private readonly ask: () => Promise<AutosaveReply>
  private readonly onSaved: (version: number) => void
  private readonly random: () => number

  constructor(ask: () => Promise<AutosaveReply>, onSaved: (version: number) => void, random: () => number = Math.random) {
    this.ask = ask
    this.onSaved = onSaved
    this.random = random
  }

  start() {
    this.after(this.random() * JITTER_MS)
  }

  /** This person just changed something. */
  noteEdit() {
    if (this.stopped) return
    if (this.asking) this.editedWhileAsking = true
    else if (this.timer === null) this.after(AFTER_EDIT_MS + this.random() * JITTER_MS)
  }

  stop() {
    this.stopped = true
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  private after(ms: number) {
    if (this.stopped) return
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.check(), ms)
  }

  private async check() {
    this.timer = null
    this.asking = true
    this.editedWhileAsking = false
    let next: number | null = null
    try {
      const reply = await this.ask()
      if (reply.saved && reply.version) this.onSaved(reply.version)
      if (reply.dirty && reply.due_in !== undefined) next = reply.due_in * 1000 + this.random() * JITTER_MS
    } catch (error) {
      const status = (error as { status?: number }).status
      if (status === 401 || status === 403 || status === 404) {
        this.stop() // they can't save this board: don't keep asking
        return
      }
      next = AFTER_FAILURE_MS + this.random() * JITTER_MS
    } finally {
      this.asking = false
    }
    if (next === null && this.editedWhileAsking) next = AFTER_EDIT_MS + this.random() * JITTER_MS
    if (next !== null) this.after(next)
  }
}
