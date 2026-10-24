import path from "node:path"
import type { NextConfig } from "next"

// The repo root (one level up) so Next.js can compile ../shared via @/shared/*
const repoRoot = path.join(import.meta.dirname, "..")

const nextConfig: NextConfig = {
  turbopack: { root: repoRoot },
  outputFileTracingRoot: repoRoot,
  // Let teammates open the dev server through an ngrok tunnel
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok-free.dev"],
}

export default nextConfig
