import type { Metadata } from "next"
import { LockIcon } from "@/components/icons"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export const metadata: Metadata = {
  title: "Log in · buck2agents",
}

// Authelia will handle the real login later. For now the button does nothing.
export default function LoginPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/50 p-4">
      <div className="flex items-center gap-2 text-xl font-semibold">
        <span className="size-8 rounded-lg bg-primary" aria-hidden />
        buck2agents
      </div>

      <Card className="w-full max-w-sm animate-in duration-300 fade-in slide-in-from-bottom-2">
        <CardHeader>
          <CardTitle className="text-2xl">Log in</CardTitle>
          <CardDescription>
            Use the account your team lead created for you.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" name="username" placeholder="raddy" autoComplete="username" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="button" className="w-full">
            Log in
          </Button>
        </CardFooter>
      </Card>

      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <LockIcon className="size-3.5" aria-hidden="true" />
        Sign-in handled by Authelia · agents never use this screen, they use tokens
      </p>
    </main>
  )
}
