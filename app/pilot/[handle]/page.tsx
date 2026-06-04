import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import Link from "next/link";
import { JsonLdScript } from "@/components/helpers/JsonLdScript";
import { api } from "@/convex/_generated/api";
import { absoluteUrl } from "@/lib/site";
import { buildPilotProfileStructuredData } from "@/lib/structuredData";
import { PilotPublicView } from "./PilotPublicView";

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
        title: "Pilot Profile | NeotypeLab",
        description: "This pilot profile is not currently available on a public surface.",
        alternates: {
          canonical: `/pilot/${params.handle}`,
        },
      };
    }

    const description = [
      `${profile.totals.publicConcepts} public concepts`,
      `${profile.totals.saves} saves`,
      `${profile.totals.remixes} remix branches`,
    ].join(" · ");
    const shareImageUrl = absoluteUrl(`/pilot/${params.handle}/opengraph-image`);

    return {
      title: `${profile.pilot.fullName} (@${profile.pilot.handle}) | NeotypeLab`,
      description,
      alternates: {
        canonical: `/pilot/${params.handle}`,
      },
      openGraph: {
        title: `${profile.pilot.fullName} (@${profile.pilot.handle}) | NeotypeLab`,
        description,
        url: `/pilot/${params.handle}`,
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
        title: `${profile.pilot.fullName} (@${profile.pilot.handle}) | NeotypeLab`,
        description,
        images: [shareImageUrl],
      },
    };
  } catch {
    return {
      title: "Pilot Profile | NeotypeLab",
      description: "Public pilot profile surface for NeotypeLab concepts.",
      alternates: {
        canonical: `/pilot/${params.handle}`,
      },
    };
  }
}

export default function PilotProfilePage({
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

    return buildPilotProfileStructuredData({
      handle: profile.pilot.handle,
      fullName: profile.pilot.fullName,
      imageUrl: profile.pilot.pictureUrl,
      publicConceptCount: profile.totals.publicConcepts,
      totalLikes: profile.totals.likes,
      totalSaves: profile.totals.saves,
      totalRemixes: profile.totals.remixes,
    });
  });

  return (
    <div className="min-h-screen bg-[#0D1117] px-4 py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <PilotStructuredData structuredDataPromise={structuredDataPromise} />
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-white/10 bg-[#11161D]/95 px-6 py-4 text-[#E6EDF3] backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#58FFB2]">NeotypeLab Public</p>
            <h1 className="mt-2 text-lg font-semibold">Pilot profile</h1>
          </div>
          <div className="flex gap-3">
            <Link
              href="/showcase"
              className="inline-flex h-10 items-center justify-center rounded-[16px] border border-white/10 px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-white/5"
            >
              Showcase
            </Link>
            <Link
              href="/t/library"
              className="inline-flex h-10 items-center justify-center rounded-[16px] border border-[#3DD9FF]/35 bg-[#0E2430] px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-[#123342]"
            >
              Open Terminal
            </Link>
          </div>
        </div>
        <PilotPublicView handle={params.handle} />
      </div>
    </div>
  );
}

async function PilotStructuredData({
  structuredDataPromise,
}: {
  structuredDataPromise: Promise<ReturnType<typeof buildPilotProfileStructuredData> | null>;
}) {
  const structuredData = await structuredDataPromise;
  if (structuredData === null) {
    return null;
  }
  return <JsonLdScript data={structuredData} />;
}
