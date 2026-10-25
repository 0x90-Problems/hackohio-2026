import type { Metadata } from "next"

import { AuthScreen } from "@/components/auth/auth-screen"

export const metadata: Metadata = {
  title: "Sign up · buck2agents",
}

export default function SignUpPage() {
  return <AuthScreen mode="signup" />
}
