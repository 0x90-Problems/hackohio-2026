import { Suspense } from "react"
import type { Metadata } from "next"

import { ChatView } from "@/components/chat/chat-view"
import { pageTitle } from "@/lib/brand"

export const metadata: Metadata = {
  title: pageTitle("Chat"),
}

// ChatView reads ?c= (channel) and ?t= (thread) from the URL, so it renders inside Suspense.
export default function ChatPage() {
  return (
    <Suspense>
      <ChatView />
    </Suspense>
  )
}
