// Builds the app for Cloudflare (NSB-84).
//
// The adapter takes the folder with the nearest lockfile as the project root. This repo has two
// (web/ and the repo root), and Next.js roots its build at the repo root so it can compile
// ../shared, so the adapter must see the repo root too, or it looks for the build output one
// folder too low. web/package-lock.json is set aside for the length of the build and always put
// back, even if the build fails or is interrupted.
import { spawnSync } from "node:child_process"
import { existsSync, renameSync } from "node:fs"
import path from "node:path"

const web = path.join(import.meta.dirname, "..")
const lock = path.join(web, "package-lock.json")
const aside = path.join(web, ".package-lock.cf-build.json")

if (existsSync(aside) && !existsSync(lock)) renameSync(aside, lock) // left over from a killed run
if (!existsSync(path.join(web, "..", "package-lock.json"))) {
  console.error("No package-lock.json at the repo root; the adapter would not find it. Not building.")
  process.exit(1)
}

let restored = false
const restore = () => {
  if (restored) return
  restored = true
  if (existsSync(aside)) renameSync(aside, lock)
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => (restore(), process.exit(130)))

renameSync(lock, aside)
let status = 1
try {
  const run = spawnSync("npx", ["opennextjs-cloudflare", "build", ...process.argv.slice(2)], { cwd: web, stdio: "inherit", shell: process.platform === "win32" })
  status = run.status ?? 1
} finally {
  restore()
}
process.exit(status)
