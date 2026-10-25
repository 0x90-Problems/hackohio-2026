import path from "node:path"
import type { NextConfig } from "next"

// The repo root (one level up) so Next.js can compile ../shared via @/shared/*
const repoRoot = path.join(import.meta.dirname, "..")
const ngrokHost = process.env.NGROK_HOST

const nextConfig: NextConfig = {
  turbopack: { root: repoRoot },
  outputFileTracingRoot: repoRoot,
  // Let teammates open the dev server through an ngrok tunnel
  allowedDevOrigins: [
    "*.ngrok-free.app",
    "*.ngrok-free.dev",
    ...(ngrokHost ? [ngrokHost] : []),
  ],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ]
  },
}

const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
]

export default nextConfig
