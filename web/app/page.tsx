import { ChangesFeed } from "@/components/home/changes-feed"
import { HomeWelcome } from "@/components/home/home-welcome"
import { PendingActions } from "@/components/home/pending-actions"
import { PendingFeed } from "@/components/home/pending-feed"
import { SiteFooter } from "@/components/site-footer"

export default function HomePage() {
  return (
    <>
      <HomeWelcome />
      <main className="bg-muted/30">
        <div className="mx-auto flex max-w-screen-2xl flex-col gap-8 px-4 py-10">
          <h2 className="mx-auto max-w-2xl text-center font-heading text-xl font-semibold tracking-tight text-balance sm:text-2xl">
            Every move your <span className="text-brand-scarlet">agents</span>{" "}
            make, on one board your{" "}
            <span className="text-brand-scarlet">team</span> can see.
          </h2>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)]">
            <div className="flex min-w-0 flex-col gap-6">
              <PendingActions />
              <PendingFeed />
            </div>
            <aside className="min-w-0">
              <ChangesFeed />
            </aside>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
