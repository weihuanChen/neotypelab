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
    <section className="rounded-[28px] border border-white/10 bg-[#11161D] p-6 text-sm text-[#9BA7B4]">
      Loading showcase feed.
    </section>
  );
}
