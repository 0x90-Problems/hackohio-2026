// Files on ticket comments (NSB-69). Dependency-free so node --test can load it.

export const MAX_COMMENT_FILES = 10

/** Where uploads from a ticket's comment box go in Folders: Ticket files/<KEY>/. */
export const TICKET_FILES_FOLDER = "Ticket files"

type Attachment = { file_id: string; version: number }

/** Only well-formed {file_id, version} pairs; anything else on a stored comment is dropped. */
export function attachmentsFrom(value: unknown): Attachment[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const { file_id: fileId, version } = item as Record<string, unknown>
    return typeof fileId === "string" && fileId.trim() && typeof version === "number" && Number.isInteger(version) && version > 0
      ? [{ file_id: fileId, version }]
      : []
  })
}

/** The folder with this name among siblings, as Folders compares names: ignoring case. */
export function folderNamed<T extends { type: string; name: string }>(items: T[], name: string): T | undefined {
  const wanted = name.toLowerCase()
  return items.find((item) => item.type === "folder" && item.name.toLowerCase() === wanted)
}
