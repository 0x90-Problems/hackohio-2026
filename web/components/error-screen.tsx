import { NutTree } from "@/components/illustrations"

// The layout shared by the 404 and error pages: the gray buckeye tree, a big
// code, a short message, and the ways out
export function ErrorScreen({
  code,
  title,
  message,
  children,
}: {
  code: string
  title: string
  message: string
  children: React.ReactNode
}) {
  return (
    <main className="flex min-h-[calc(100svh-3.5rem)] flex-col items-center justify-center gap-6 bg-background px-4 py-12 text-center">
      <NutTree className="w-full max-w-xs animate-in duration-500 fade-in slide-in-from-bottom-2" />
      <div className="flex flex-col items-center gap-2">
        <p className="font-mono text-sm tracking-widest text-muted-foreground">
          {code}
        </p>
        <h1 className="font-heading text-3xl font-bold tracking-tight">
          {title}
        </h1>
        <p className="max-w-md text-muted-foreground">{message}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">{children}</div>
    </main>
  )
}
