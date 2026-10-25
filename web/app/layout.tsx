import type { Metadata } from "next"
import { Geist_Mono, Inter } from "next/font/google"

import "./globals.css"
import { AppHeader } from "@/components/app-header"
import { AuthGate } from "@/components/auth/auth-gate"
import { ChatDock } from "@/components/assistant/chat-dock"
import { ProjectsProvider } from "@/components/projects/projects-store"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { PRODUCT_NAME } from "@/lib/brand"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: {
    default: PRODUCT_NAME,
    template: `%s · ${PRODUCT_NAME}`,
  },
  applicationName: PRODUCT_NAME,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { url: "/icon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/logo-mark.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
}

const inter = Inter({subsets:['latin'],variable:'--font-sans'})

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
      className={cn("antialiased", fontMono.variable, "font-sans", inter.variable)}
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
