"use client"

import { useEffect, useState } from "react"

// Dates are stored as ISO strings. These fields come back as Date objects.
const DATE_KEY = /_at$/

export function reviveValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => reviveValue(item)) as T
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (DATE_KEY.test(key) && (typeof item === "string" || item === null)) {
        if (item === null) out[key] = null
        else {
          const date = new Date(item)
          out[key] = Number.isNaN(date.getTime()) ? item : date
        }
      } else {
        out[key] = reviveValue(item)
      }
    }
    return out as T
  }
  return value
}

export function readStorage<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return undefined
    return reviveValue(JSON.parse(raw) as T)
  } catch {
    return undefined
  }
}

export function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // A full disk or private mode should not block the page.
  }
}

// Remembers the latest value across reloads. The first render matches the
// server (the initial value); the saved copy is applied after mount.
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState(initial)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const saved = readStorage<T>(key)
    if (saved !== undefined) setValue(saved)
    setReady(true)
  }, [key])

  useEffect(() => {
    if (!ready) return
    writeStorage(key, value)
  }, [key, ready, value])

  return [value, setValue] as const
}
