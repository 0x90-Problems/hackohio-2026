// An upload only becomes a file once someone asks after it, and the virus scan takes about half a
// minute. So this browser remembers what it sent, and asks again if the tab was closed before then.

export type PendingUpload = { upload_id: string; name: string; at: number }

export type Settled =
  | { upload: PendingUpload; outcome: "added" }
  | { upload: PendingUpload; outcome: "refused"; message: string }

const KEY = "nutshell.pending-uploads"
const MAX_AGE_MS = 24 * 3600 * 1000 // an upload that never arrived stays "waiting" for good

export function parsePending(raw: string | null, now: number): PendingUpload[] {
  try {
    const list: unknown = JSON.parse(raw ?? "[]")
    if (!Array.isArray(list)) return []
    return list.filter(
      (item): item is PendingUpload =>
        typeof item?.upload_id === "string" && typeof item?.name === "string" && typeof item?.at === "number" && now - item.at < MAX_AGE_MS
    )
  } catch {
    return []
  }
}

function read(): PendingUpload[] {
  try {
    return parsePending(localStorage.getItem(KEY), Date.now())
  } catch {
    return []
  }
}

function write(list: PendingUpload[]) {
  try {
    if (list.length) localStorage.setItem(KEY, JSON.stringify(list))
    else localStorage.removeItem(KEY)
  } catch {
    // Private windows can refuse storage. The upload still works while the tab stays open.
  }
}

export function rememberUpload(upload_id: string, name: string) {
  write([...read().filter((item) => item.upload_id !== upload_id), { upload_id, name, at: Date.now() }])
}

export function forgetUpload(upload_id: string) {
  write(read().filter((item) => item.upload_id !== upload_id))
}

/** Answers from the server that won't change: anything else (offline, a 5xx) is worth asking again. */
export function isFinalRefusal(status: number) {
  return status >= 400 && status < 500 && status !== 408 && status !== 429
}

/**
 * Ask once after each upload. "pending" means ask again later; a thrown error with a final status
 * means the server has refused it.
 */
export async function settlePending(
  list: PendingUpload[],
  ask: (uploadId: string) => Promise<"added" | "pending">,
  statusOf: (error: unknown) => { status: number; message: string }
): Promise<{ settled: Settled[]; waiting: PendingUpload[] }> {
  const settled: Settled[] = []
  const waiting: PendingUpload[] = []
  for (const upload of list) {
    try {
      if ((await ask(upload.upload_id)) === "added") settled.push({ upload, outcome: "added" })
      else waiting.push(upload)
    } catch (error) {
      const { status, message } = statusOf(error)
      if (isFinalRefusal(status)) settled.push({ upload, outcome: "refused", message })
      else waiting.push(upload)
    }
  }
  return { settled, waiting }
}

export function pendingUploads(): PendingUpload[] {
  return read()
}
