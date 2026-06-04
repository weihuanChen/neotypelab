import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import Link from "next/link";
import { Suspense } from "react";
import { JsonLdScript } from "@/components/helpers/JsonLdScript";
import { api } from "@/convex/_generated/api";
import { absoluteUrl } from "@/lib/site";
import { buildShowcaseStructuredData } from "@/lib/structuredData";
import { ShowcaseFeed } from "./ShowcaseFeed";

export const metadata: Metadata = {
  title: "NeotypeLab Showcase",
  description:
    "Browse public mecha repaint prototypes, paint mapping plans, and community-ready style DNA surfaces.",
  alternates: {
    canonical: "/showcase",
  },
  openGraph: {
    title: "NeotypeLab Showcase",
    description:
      "Browse public mecha repaint prototypes, paint mapping plans, and community-ready style DNA surfaces.",
    url: "/showcase",
    type: "website",
    images: [
      {
        url: absoluteUrl("/showcase/opengraph-image"),
        alt: "NeotypeLab Showcase",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NeotypeLab Showcase",
    description:
      "Browse public mecha repaint prototypes, paint mapping plans, and community-ready style DNA surfaces.",
    images: [absoluteUrl("/showcase/opengraph-image")],
  },
};

export default function ShowcasePage() {
  const structuredDataPromise = fetchQuery(api.showcase.listPublicConcepts).then((concepts) =>
    buildShowcaseStructuredData({
      conceptCount: concepts.length,
      sorts: ["trending", "recent", "most saved", "most remixed"],
    })
  );

  return (
    <div className="min-h-screen bg-[#0D1117] px-4 py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <ShowcaseStructuredData structuredDataPromise={structuredDataPromise} />
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-white/10 bg-[#11161D]/95 px-6 py-4 text-[#E6EDF3] backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#58FFB2]">NeotypeLab Public</p>
            <h1 className="mt-2 text-lg font-semibold">Published prototype showcase</h1>
          </div>
          <div className="flex gap-3">
            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-[16px] border border-white/10 px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-white/5"
            >
              Home
            </Link>
            <Link
              href="/t/showcase"
              className="inline-flex h-10 items-center justify-center rounded-[16px] border border-[#3DD9FF]/35 bg-[#0E2430] px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-[#123342]"
            >
              Open Terminal
            </Link>
          </div>
        </div>
        <Suspense fallback={<ShowcaseFeedFallback />}>
          <ShowcaseFeed />
        </Suspense>
      </div>
    </div>
  );
}

async function ShowcaseStructuredData({
  structuredDataPromise,
}: {
  structuredDataPromise: Promise<ReturnType<typeof buildShowcaseStructuredData>>;
}) {
  const structuredData = await structuredDataPromise;
  return <JsonLdScript data={structuredData} />;
}

function ShowcaseFeedFallback() {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[#11161D] p-6 text-sm text-[#9BA7B4]">
      Loading showcase feed.
    </section>
  );
}
