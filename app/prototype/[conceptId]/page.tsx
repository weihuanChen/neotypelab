import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import Link from "next/link";
import { JsonLdScript } from "@/components/helpers/JsonLdScript";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { absoluteUrl } from "@/lib/site";
import { buildPrototypeStructuredData } from "@/lib/structuredData";
import { PrototypePublicView } from "./PrototypePublicView";

export async function generateMetadata({
  params,
}: {
  params: { conceptId: string };
}): Promise<Metadata> {
  try {
    const concept = await fetchQuery(api.showcase.getSharedConcept, {
      conceptId: params.conceptId as Id<"concepts">,
    });

    if (concept === null) {
      return {
        title: "Shared Prototype | NeotypeLab",
        description: "This prototype is no longer available on a public or unlisted share surface.",
        alternates: {
          canonical: `/prototype/${params.conceptId}`,
        },
      };
    }

    const description = [
      concept.baseModel?.name ?? "Unknown base model",
      concept.stylePreset?.name ?? "Unknown Style DNA",
      concept.materialPreset?.name ?? "Unknown material profile",
    ].join(" · ");
    const shareImageUrl = absoluteUrl(`/prototype/${params.conceptId}/opengraph-image`);

    return {
      title: `${concept.title} | NeotypeLab`,
      description,
      alternates: {
        canonical: `/prototype/${params.conceptId}`,
      },
      openGraph: {
        title: `${concept.title} | NeotypeLab`,
        description,
        url: `/prototype/${params.conceptId}`,
        type: "article",
        images: [
          {
            url: shareImageUrl,
            alt: concept.title,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: `${concept.title} | NeotypeLab`,
        description,
        images: [shareImageUrl],
      },
    };
  } catch {
    return {
      title: "Shared Prototype | NeotypeLab",
      description: "Shared mecha repaint prototype and paint mapping surface.",
      alternates: {
        canonical: `/prototype/${params.conceptId}`,
      },
    };
  }
}

export default function PrototypePage({
  params,
}: {
  params: { conceptId: string };
}) {
  const structuredDataPromise = fetchQuery(api.showcase.getSharedConcept, {
    conceptId: params.conceptId as Id<"concepts">,
  }).then((concept) => {
    if (concept === null) {
      return null;
    }

    const description = [
      concept.baseModel?.name ?? "Unknown base model",
      concept.stylePreset?.name ?? "Unknown Style DNA",
      concept.materialPreset?.name ?? "Unknown material profile",
    ].join(" · ");

    return buildPrototypeStructuredData({
      conceptId: params.conceptId,
      title: concept.title,
      description,
      imageUrl: concept.previewAsset?.publicUrl,
      authorHandle: concept.owner?.handle,
      authorName: concept.owner?.fullName,
      baseModelName: concept.baseModel?.name,
      stylePresetName: concept.stylePreset?.name,
      materialPresetName: concept.materialPreset?.name,
      visibility: concept.visibility,
      likeCount: concept.engagement.likeCount,
      saveCount: concept.engagement.saveCount,
      remixCount: concept.remixCount,
    });
  });

  return (
    <div className="min-h-screen bg-[#0D1117] px-4 py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <PrototypeStructuredData structuredDataPromise={structuredDataPromise} />
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-white/10 bg-[#11161D]/95 px-6 py-4 text-[#E6EDF3] backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#58FFB2]">NeotypeLab Public</p>
            <h1 className="mt-2 text-lg font-semibold">Shared prototype</h1>
          </div>
          <div className="flex gap-3">
            <Link
              href="/showcase"
              className="inline-flex h-10 items-center justify-center rounded-[16px] border border-white/10 px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-white/10"
            >
              Showcase
            </Link>
            <Link
              href="/t/library"
              className="inline-flex h-10 items-center justify-center rounded-[16px] border border-[#3DD9FF]/35 bg-[#0E2430] px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-white/10"
            >
              Open Terminal
            </Link>
          </div>
        </div>
        <PrototypePublicView conceptId={params.conceptId} />
      </div>
    </div>
  );
}

async function PrototypeStructuredData({
  structuredDataPromise,
}: {
  structuredDataPromise: Promise<ReturnType<typeof buildPrototypeStructuredData> | null>;
}) {
  const structuredData = await structuredDataPromise;
  if (structuredData === null) {
    return null;
  }
  return <JsonLdScript data={structuredData} />;
}
