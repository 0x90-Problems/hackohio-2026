import Link from "next/link"

import { ErrorScreen } from "@/components/error-screen"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <ErrorScreen
      code="404"
      title="Nothing on this branch"
      message="This page fell off the tree, or it never grew here. Check the address, or head back to your boards."
    >
      <Button asChild>
        <Link href="/">Go home</Link>
      </Button>
      <Button asChild variant="outline">
        <Link href="/projects">Open projects</Link>
      </Button>
    </ErrorScreen>
  )
}
