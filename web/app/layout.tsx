import type { Metadata } from "next"
import { Geist_Mono, Inter, Lato } from "next/font/google"

import "./globals.css"
import { AppHeader } from "@/components/app-header"
import { AuthGate } from "@/components/auth/auth-gate"
import { ChatDock } from "@/components/assistant/chat-dock"
import { ProjectsProvider } from "@/components/projects/projects-store"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "NutShell",
}

const inter = Inter({subsets:['latin'],variable:'--font-sans'})

// Headings use Lato, the same typeface as the NutShell wordmark
const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-lato",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", inter.variable, lato.variable)}
    >
      <body>
        {/* Light mode is the default; dark mode still works (press "d") */}
        <ThemeProvider defaultTheme="light" enableSystem={false}>
          <TooltipProvider>
            <AuthGate>
              <AppHeader />
              {/* One shared store for every page, so board changes (by people or
                  the chat assistant) survive moving between pages */}
              <ProjectsProvider>
                {children}
                <ChatDock />
              </ProjectsProvider>
            </AuthGate>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
