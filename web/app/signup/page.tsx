import type { Metadata } from "next"

import { AuthScreen } from "@/components/auth/auth-screen"
import { pageTitle } from "@/lib/brand"

export const metadata: Metadata = {
  title: pageTitle("Sign up"),
}

export default function SignUpPage() {
  return <AuthScreen mode="signup" />
}
