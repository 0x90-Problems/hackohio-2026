"use client"

import { useEffect, useState } from "react"

// Pretends data takes a moment to load, so pages can show their Skeletons.
// Replace with a real fetch once the database is connected.
export function useMockLoading(ms = 700) {
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), ms)
    return () => clearTimeout(timer)
  }, [ms])
  return loading
}
