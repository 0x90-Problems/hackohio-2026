"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LockIcon } from "lucide-react"

import {
  AuthApiError,
  signIn,
  signUp,
  validateSignIn,
  validateSignUp,
} from "@/lib/board-auth"
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
import { Alert, AlertDescription } from "@/components/ui/alert"

export function AuthScreen({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const signup = mode === "signup"

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const username = String(form.get("username") ?? "")
    const password = String(form.get("password") ?? "")
    const name = String(form.get("name") ?? "")
    const email = String(form.get("email") ?? "")
    const team = String(form.get("team") ?? "")
    const problem = signup
      ? validateSignUp({ username, password, name, email, team })
      : validateSignIn({ username, password })
    if (problem) {
      setError(problem)
      return
    }

    setPending(true)
    setError(null)
    try {
      if (signup) await signUp({ username, password, name, email, team })
      else await signIn({ username, password })
      router.push("/")
      router.refresh()
    } catch (caught) {
      setError(caught instanceof AuthApiError ? caught.message : "Could not reach the sign-in service.")
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/50 p-4">
      <div className="flex items-center gap-2 text-xl font-semibold">
        <span className="size-8 rounded-lg bg-primary" aria-hidden />
        buck2agents
      </div>

      <Card className="w-full max-w-sm animate-in duration-300 fade-in slide-in-from-bottom-2">
        <form className="flex flex-col gap-(--card-spacing)" noValidate onSubmit={onSubmit}>
          <CardHeader>
            <CardTitle className="text-2xl">{signup ? "Sign up" : "Log in"}</CardTitle>
            <CardDescription>
              {signup
                ? "Create an account on this board."
                : "Use the account your team lead created for you."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            {signup ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" placeholder="Naz" autoComplete="name" />
              </div>
            ) : null}
            <div className="flex flex-col gap-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" name="username" placeholder="raddy" autoComplete="username" />
            </div>
            {signup ? (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="optional"
                    autoComplete="email"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="team">Team</Label>
                  <Input id="team" name="team" placeholder="optional" autoComplete="organization" />
                </div>
              </>
            ) : null}
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={signup ? "new-password" : "current-password"}
              />
            </div>
          </CardContent>
          <CardFooter className="flex-col items-stretch gap-3">
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? (signup ? "Creating account…" : "Logging in…") : signup ? "Sign up" : "Log in"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {signup ? (
                <>
                  Already have an account?{" "}
                  <Link href="/login" className="text-foreground underline underline-offset-4">
                    Log in
                  </Link>
                </>
              ) : (
                <>
                  Need an account?{" "}
                  <Link href="/signup" className="text-foreground underline underline-offset-4">
                    Sign up
                  </Link>
                </>
              )}
            </p>
          </CardFooter>
        </form>
      </Card>

      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <LockIcon className="size-3.5" />
        Passwords stay in the directory · agents never use this screen, they use tokens
      </p>
    </main>
  )
}
