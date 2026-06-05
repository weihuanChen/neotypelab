import { ShowcaseFeed } from "@/app/showcase/ShowcaseFeed";
import { Suspense } from "react";

export default function ShowcasePage() {
  return (
    <Suspense fallback={<ShowcaseFeedFallback />}>
      <ShowcaseFeed terminalMode />
    </Suspense>
  );
}

function ShowcaseFeedFallback() {
  return (
    <section className="border-2 border-line-primary bg-panel p-6 text-sm text-ink-secondary">
      Loading showcase feed.
    </section>
  );
}
