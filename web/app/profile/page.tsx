import type { Metadata } from "next"

import { MyProfile } from "@/components/profile/my-profile"
import { pageTitle } from "@/lib/brand"

export const metadata: Metadata = {
  title: pageTitle("Your profile"),
}

export default function ProfilePage() {
  return <MyProfile />
}
