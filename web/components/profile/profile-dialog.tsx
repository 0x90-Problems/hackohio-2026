"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { useAuthUser } from "@/components/auth/auth-gate"
import { MessagesSquareIcon } from "@/components/icons"
import { ProfileView } from "@/components/profile/profile-view"
import { useBoardDirectory } from "@/lib/use-board-directory"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { chatApi } from "@/lib/chat-api"

const OpenProfileContext = createContext<((userId: string) => void) | null>(
  null
)

// Chat may be off for the team; ask once per page load.
let chatCheck: Promise<boolean> | null = null
function chatEnabled() {
  chatCheck ??= chatApi.enabled().catch(() => false)
  return chatCheck
}

// Lets any name or avatar open that person's profile in a popup.
// Mounted once in app/layout.tsx, inside ProjectsProvider.
export function ProfileDialogProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const account = useAuthUser()
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [chatOn, setChatOn] = useState(false)
  const [opening, setOpening] = useState(false)
  const open = useCallback((id: string) => setUserId(id), [])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void chatEnabled().then((on) => !cancelled && setChatOn(on))
    return () => {
      cancelled = true
    }
  }, [userId])

  // Opens (or reuses) the direct message with this person and goes there.
  const message = async (id: string) => {
    setOpening(true)
    try {
      const channel = await chatApi.openDm([`user:${id}`])
      setUserId(null)
      router.push(`/chat?c=${encodeURIComponent(channel.id)}`)
    } catch (caught) {
      toast.error("Couldn't open a direct message", {
        description: caught instanceof Error ? caught.message : undefined,
      })
    } finally {
      setOpening(false)
    }
  }

  const self = userId !== null && userId === account?._id
  // Their name, for the message button's label.
  const name = useBoardDirectory().people.find((person) => person._id === userId)?.name ?? "them"

  return (
    <OpenProfileContext.Provider value={open}>
      {children}
      <Dialog
        open={userId !== null}
        onOpenChange={(o) => !o && setUserId(null)}
      >
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl lg:max-w-4xl sm:p-8">
          <DialogTitle className="sr-only">Profile</DialogTitle>
          <DialogDescription className="sr-only">
            Activity and agents for this person
          </DialogDescription>
          {userId && (
            <ProfileView
              userId={userId}
              compact
              nameAction={
                !self && chatOn ? (
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={opening}
                    onClick={() => void message(userId)}
                    aria-label={`Message ${name}`}
                    title={`Message ${name}`}
                  >
                    <MessagesSquareIcon aria-hidden="true" />
                  </Button>
                ) : null
              }
            />
          )}
          {self && (
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
