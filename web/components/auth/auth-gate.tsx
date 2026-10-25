"use client"

import { useEffect, useSyncExternalStore } from "react"
import { usePathname, useRouter } from "next/navigation"

import { readSession, subscribeAuth, type AuthSession, type AuthUser } from "@/lib/board-auth"

const PUBLIC_PATHS = ["/login", "/signup"]

const SERVER_AUTH = { ready: false, session: null as AuthSession | null }

type ClientAuth = { ready: true; session: AuthSession | null }

let clientAuth: ClientAuth | null = null

function readClientAuth(): ClientAuth {
  const session = readSession()
  if (clientAuth && clientAuth.session === session) return clientAuth
  clientAuth = { ready: true, session }
  return clientAuth
}

function subscribeClientAuth(onChange: () => void): () => void {
  return subscribeAuth(() => {
    clientAuth = null
    onChange()
  })
}

function getServerAuth() {
  return SERVER_AUTH
}

function useClientAuth(): { ready: boolean; session: AuthSession | null } {
  return useSyncExternalStore(subscribeClientAuth, readClientAuth, getServerAuth)
}

export function useAuthUser(): AuthUser | null {
  return useClientAuth().session?.user ?? null
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { ready, session } = useClientAuth()
  const isPublic = PUBLIC_PATHS.includes(pathname)

  useEffect(() => {
    if (!ready || isPublic || session) return
    router.replace("/login")
  }, [ready, isPublic, session, router])

  if (isPublic) return children
  if (!ready || !session) return null
  return children
}
