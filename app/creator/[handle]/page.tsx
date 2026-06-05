import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import Link from "next/link";
import { JsonLdScript } from "@/components/helpers/JsonLdScript";
import { api } from "@/convex/_generated/api";
import { absoluteUrl } from "@/lib/site";
import { buildCreatorHubStructuredData } from "@/lib/structuredData";
import { CreatorHubView } from "./CreatorHubView";

export async function generateMetadata({
  params,
}: {
  params: { handle: string };
}): Promise<Metadata> {
  try {
    const profile = await fetchQuery(api.showcase.getPublicProfile, {
      handle: params.handle,
    });

    if (profile === null) {
      return {
        title: "Creator Hub | NeotypeLab",
        description: "This creator hub is not currently available.",
        alternates: {
          canonical: `/creator/${params.handle}`,
        },
      };
    }

    const description = [
      `${profile.totals.publicConcepts} public concepts`,
      `${profile.creatorPackCollection.length} creator packs`,
      `${profile.styleCollection.length} creator styles`,
    ].join(" · ");
    const shareImageUrl = absoluteUrl(`/creator/${params.handle}/opengraph-image`);

    return {
      title: `${profile.pilot.fullName} creator hub | NeotypeLab`,
      description,
      alternates: {
        canonical: `/creator/${params.handle}`,
      },
      openGraph: {
        title: `${profile.pilot.fullName} creator hub | NeotypeLab`,
        description,
        url: `/creator/${params.handle}`,
        type: "profile",
        images: [
          {
            url: shareImageUrl,
            alt: profile.pilot.fullName,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: `${profile.pilot.fullName} creator hub | NeotypeLab`,
        description,
        images: [shareImageUrl],
      },
    };
  } catch {
    return {
      title: "Creator Hub | NeotypeLab",
      description: "Creator hub surface for packs, styles, and public concepts.",
      alternates: {
        canonical: `/creator/${params.handle}`,
      },
    };
  }
}

export default function CreatorHubPage({
  params,
}: {
  params: { handle: string };
}) {
  const structuredDataPromise = fetchQuery(api.showcase.getPublicProfile, {
    handle: params.handle,
  }).then((profile) => {
    if (profile === null) {
      return null;
    }

    return buildCreatorHubStructuredData({
      handle: profile.pilot.handle,
      fullName: profile.pilot.fullName,
      imageUrl: profile.pilot.pictureUrl,
      publicConceptCount: profile.totals.publicConcepts,
      totalLikes: profile.totals.likes,
      totalSaves: profile.totals.saves,
      totalRemixes: profile.totals.remixes,
      creatorPackCount: profile.creatorPackCollection.length,
      styleCollectionCount: profile.styleCollection.length,
    });
  });

  return (
    <div className="min-h-screen bg-[#0D1117] px-4 py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <CreatorHubStructuredData structuredDataPromise={structuredDataPromise} />
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-white/10 bg-[#11161D]/95 px-6 py-4 text-[#E6EDF3] backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#58FFB2]">NeotypeLab Public</p>
            <h1 className="mt-2 text-lg font-semibold">Creator hub</h1>
          </div>
          <div className="flex gap-3">
            <Link
              href="/showcase"
              className="inline-flex h-10 items-center justify-center rounded-[16px] border border-white/10 px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-white/10"
            >
              Showcase
            </Link>
            <Link
              href={`/pilot/${params.handle}`}
              className="inline-flex h-10 items-center justify-center rounded-[16px] border border-[#3DD9FF]/35 bg-[#0E2430] px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-white/10"
            >
              Pilot Profile
            </Link>
          </div>
        </div>
        <CreatorHubView handle={params.handle} />
      </div>
    </div>
  );
}

async function CreatorHubStructuredData({
  structuredDataPromise,
}: {
  structuredDataPromise: Promise<ReturnType<typeof buildCreatorHubStructuredData> | null>;
}) {
  const structuredData = await structuredDataPromise;
  if (structuredData === null) {
    return null;
  }
  return <JsonLdScript data={structuredData} />;
}
