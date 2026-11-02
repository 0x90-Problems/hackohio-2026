"use client"

import { foldersApi, FoldersError } from "@/lib/folders-api"
import { imageFileName, imageProblem, isRaster, type LoadedImage, MAX_IMAGE_BYTES } from "@/lib/whiteboard-files"

// Images go through the normal Files upload: scanned, in the board's folder, with the folder's
// permissions. The board only stores the id, and each viewer fetches the image as themselves.

class ImageRefused extends Error {
  readonly status = 415
}

function asDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("Couldn't read the image."))
    reader.readAsDataURL(blob)
  })
}

export async function uploadBoardImage(file: File, parentId: string, boardName: string, onStatus?: (status: string) => void): Promise<string> {
  const problem = imageProblem(file)
  if (problem) throw new Error(problem)
  const tag = crypto.randomUUID().slice(0, 8)
  const named = new File([file], imageFileName(boardName, file.type, tag), { type: file.type })
  try {
    const state = await foldersApi.upload(named, { parentId }, onStatus)
    if (!state.file) throw new Error("The image didn't finish uploading.")
    return state.file.id
  } catch (error) {
    if (error instanceof FoldersError && error.code === "blocked") throw new Error("That image failed the security scan.")
    throw error
  }
}

/** One image, as the person looking at the board. Only formats that can't carry script are accepted back. */
export async function fetchBoardImage(fileId: string): Promise<LoadedImage> {
  const link = await foldersApi.link(fileId, undefined, true)
  if (!link.inline) throw new ImageRefused("Not an image.")
  const response = await fetch(link.url, { cache: "no-store" })
  if (!response.ok) throw Object.assign(new Error("Couldn't load the image."), { status: response.status === 403 ? 503 : response.status })
  const blob = await response.blob()
  if (!isRaster(blob.type) || blob.size > MAX_IMAGE_BYTES * 3) throw new ImageRefused("Not an image this board can show.")
  return { id: fileId, mimeType: blob.type, dataURL: await asDataUrl(blob), created: Date.now() }
}
