"use client"

import { useAuthUser } from "@/components/auth/auth-gate"
import { ProfileView } from "@/components/profile/profile-view"

// The signed-in person's own profile (/profile)
export function MyProfile() {
  const account = useAuthUser()
  return (
    <main className="mx-auto flex max-w-screen-lg animate-in flex-col gap-6 px-4 py-8 duration-300 fade-in">
      {account && <ProfileView userId={account._id} />}
    </main>
  )
}
