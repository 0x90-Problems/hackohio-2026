"use client"

// Profile and organization pictures (NSB-97) in the browser: who has which picture (filled in
// wherever the page loads people), shrinking an uploaded image to a small square, and saving it.

import { useSyncExternalStore } from "react"

import { readSession } from "@/lib/board-auth"
import { fitPicture, safePicture } from "@/lib/picture-data"
import { boardContextHeaders } from "@/lib/team-choice"

const pictures = new Map<string, string>()
const listeners = new Set<() => void>()
let version = 0

function changed() {
  version += 1
  for (const listener of listeners) listener()
}

/** Records the pictures of people the page just loaded (rows without one clear theirs). */
export function rememberPictures(people: unknown): void {
  if (!Array.isArray(people)) return
  let dirty = false
  for (const item of people) {
    if (!item || typeof item !== "object") continue
    const { _id, picture } = item as { _id?: unknown; picture?: unknown }
    if (typeof _id !== "string") continue
    const safe = safePicture(picture)
    if ((pictures.get(_id) ?? "") === (safe ?? "")) continue
    if (safe) pictures.set(_id, safe)
    else pictures.delete(_id)
    dirty = true
  }
  if (dirty) changed()
}

export function setPicture(userId: string, picture: string | null): void {
  const safe = safePicture(picture)
  if (safe) pictures.set(userId, safe)
  else pictures.delete(userId)
  changed()
}

/** A person's picture, kept up to date as people load. */
export function usePicture(userId: string | undefined): string | undefined {
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => version,
    () => 0
  )
  return userId ? pictures.get(userId) : undefined
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("That file isn't a picture we can read."))
    image.src = url
  })
}

/** Crops the middle square of an image file and shrinks it to fit the board's limit. */
export async function shrinkPicture(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("Pick a PNG, JPEG or WebP picture.")
  const image = await loadImage(file)
  try {
    const side = Math.min(image.naturalWidth, image.naturalHeight)
    const sx = (image.naturalWidth - side) / 2
    const sy = (image.naturalHeight - side) / 2
    const canvas = document.createElement("canvas")
    const context = canvas.getContext("2d")
    if (!context) throw new Error("This browser can't resize pictures.")
    return await fitPicture(async (size, quality) => {
      canvas.width = size
      canvas.height = size
      context.clearRect(0, 0, size, size)
      context.drawImage(image, sx, sy, side, side, 0, 0, size, size)
      const webp = canvas.toDataURL("image/webp", quality)
      // Browsers without WebP encoding hand back PNG; JPEG is the smaller fallback.
      return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", quality)
    })
  } finally {
    URL.revokeObjectURL(image.src)
  }
}

async function send(path: string, method: string, body?: object) {
  const session = readSession()
  const response = await fetch(path, {
    method,
    headers: {
      ...boardContextHeaders(),
      ...(body ? { "content-type": "application/json" } : {}),
      ...(session?.secret ? { authorization: `Bearer ${session.secret}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }).catch(() => null)
  if (!response) throw new Error("Couldn't reach the board. Check your connection and try again.")
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
    throw new Error(payload?.error?.message ?? "Couldn't save the picture")
  }
}

/** Sets (or, with null, removes) your own picture. */
export async function saveMyPicture(userId: string, picture: string | null): Promise<void> {
  await send("/api/me/picture", picture ? "PUT" : "DELETE", picture ? { picture } : undefined)
  setPicture(userId, picture)
}

/** Sets (or removes) the organization's picture. Org admins only; the board checks. */
export async function saveOrgPicture(picture: string | null): Promise<void> {
  await send("/api/site", "POST", { kind: "organizationPicture", picture })
}
