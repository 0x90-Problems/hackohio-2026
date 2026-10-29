// Serve Excalidraw's fonts from this site instead of its default CDN (esm.sh),
// so the page's CSP can keep font-src to 'self'. Runs before every build (prebuild).
import { cpSync, existsSync, rmSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const web = join(dirname(fileURLToPath(import.meta.url)), "..")
const source = join(web, "node_modules", "@excalidraw", "excalidraw", "dist", "prod", "fonts")
const target = join(web, "public", "excalidraw-assets", "fonts")

if (!existsSync(source)) {
  console.error(`copy-excalidraw-assets: ${source} not found (run npm ci first)`)
  process.exit(1)
}
rmSync(target, { recursive: true, force: true })
cpSync(source, target, { recursive: true })
console.log("copy-excalidraw-assets: fonts copied to public/excalidraw-assets/fonts")
