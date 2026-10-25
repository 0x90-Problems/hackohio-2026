"use client"

import { useEffect } from "react"
import Link from "next/link"

import { ErrorScreen } from "@/components/error-screen"
import { Button } from "@/components/ui/button"

export default function Error({
  error,
  retry,
}: {
  error: unknown
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <ErrorScreen
      code="ERROR"
      title="A nut fell from the tree"
      message="Something went wrong loading this page. Your board is safe; try again, and if it keeps happening, let the team know."
    >
      <Button onClick={() => retry()}>Try again</Button>
      <Button asChild variant="outline">
        <Link href="/">Go home</Link>
      </Button>
    </ErrorScreen>
  )
}
