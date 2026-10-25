"use client"

import { createContext, useCallback, useContext, useState } from "react"
import Link from "next/link"

import { useAuthUser } from "@/components/auth/auth-gate"
import { ProfileView } from "@/components/profile/profile-view"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"

const OpenProfileContext = createContext<((userId: string) => void) | null>(
  null
)

// Lets any name or avatar open that person's profile in a popup.
// Mounted once in app/layout.tsx, inside ProjectsProvider.
export function ProfileDialogProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const account = useAuthUser()
  const [userId, setUserId] = useState<string | null>(null)
  const open = useCallback((id: string) => setUserId(id), [])

  return (
    <OpenProfileContext.Provider value={open}>
      {children}
      <Dialog
        open={userId !== null}
        onOpenChange={(o) => !o && setUserId(null)}
      >
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
          <DialogTitle className="sr-only">Profile</DialogTitle>
          <DialogDescription className="sr-only">
            Activity and agents for this person
          </DialogDescription>
          {userId && <ProfileView userId={userId} compact />}
          {userId && userId === account?._id && (
            <Button asChild variant="outline" className="self-start">
              <Link href="/profile" onClick={() => setUserId(null)}>
                Open your full profile
              </Link>
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </OpenProfileContext.Provider>
  )
}

export function useOpenProfile() {
  return useContext(OpenProfileContext)
}
