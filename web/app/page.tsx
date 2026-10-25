import { ChangesFeed } from "@/components/home/changes-feed"
import { HomeWelcome } from "@/components/home/home-welcome"
import { PendingFeed } from "@/components/home/pending-feed"
import { SiteFooter } from "@/components/site-footer"

export default function HomePage() {
  return (
    <>
      <main className="mx-auto grid max-w-screen-2xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <HomeWelcome />
          <PendingFeed />
        </div>

        <aside className="min-w-0">
          <ChangesFeed />
        </aside>
      </main>
      <SiteFooter />
    </>
  )
}
