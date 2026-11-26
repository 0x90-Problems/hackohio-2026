// Profile and organization pictures (NSB-97), the parts with no browser APIs so node --test can
// load them. The board keeps a picture inline as a small data: URL (its src/pictures.ts checks the
// same rules), so the web only ever shows PNG, JPEG or WebP data URLs, never an outside link.

export const MAX_PICTURE_BYTES = 24_000

const PICTURE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/

/** The picture if it's one the page may show, else undefined. */
export function safePicture(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > Math.ceil(MAX_PICTURE_BYTES / 3) * 4 + 40) return undefined
  return PICTURE.test(value) ? value : undefined
}

/** Decoded size of a base64 data URL, in bytes. */
export function dataUrlBytes(url: string): number {
  const data = url.slice(url.indexOf(",") + 1)
  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0
  return Math.floor((data.length * 3) / 4) - padding
}

// Largest first, then smaller and lower quality until the picture fits.
export const PICTURE_SIZES = [192, 160, 128, 96, 64] as const
export const PICTURE_QUALITIES = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4] as const

/**
 * The first encoding (size, then quality) that fits in maxBytes. `encode` draws the square at that
 * size and returns a data URL. Throws if even the smallest doesn't fit.
 */
export async function fitPicture(
  encode: (size: number, quality: number) => Promise<string>,
  maxBytes = MAX_PICTURE_BYTES
): Promise<string> {
  for (const size of PICTURE_SIZES) {
    for (const quality of PICTURE_QUALITIES) {
      const url = await encode(size, quality)
      if (safePicture(url) && dataUrlBytes(url) <= maxBytes) return url
    }
  }
  throw new Error("That picture is too detailed to shrink. Try another one.")
}
