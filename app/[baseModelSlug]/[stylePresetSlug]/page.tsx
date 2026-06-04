import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import Link from "next/link";
import { JsonLdScript } from "@/components/helpers/JsonLdScript";
import { api } from "@/convex/_generated/api";
import { absoluteUrl } from "@/lib/site";
import { buildLandingPageStructuredData } from "@/lib/structuredData";
import { SeoLandingPageView } from "./SeoLandingPageView";

export async function generateMetadata({
  params,
}: {
  params: { baseModelSlug: string; stylePresetSlug: string };
}): Promise<Metadata> {
  try {
    const landing = await fetchQuery(api.showcase.getSeoLandingPage, {
      baseModelSlug: params.baseModelSlug,
      stylePresetSlug: params.stylePresetSlug,
    });

    if (landing === null) {
      return {
        title: "Style Landing Page | NeotypeLab",
        description: "This base model and Style DNA landing page is not yet available.",
        alternates: {
          canonical: `/${params.baseModelSlug}/${params.stylePresetSlug}`,
        },
      };
    }

    const description = [
      `${landing.baseModel.name} repaint ideas`,
      landing.stylePreset.name,
      `${landing.conceptCount} public concept${landing.conceptCount === 1 ? "" : "s"}`,
    ].join(" · ");
    const shareImageUrl = absoluteUrl(
      `/${params.baseModelSlug}/${params.stylePresetSlug}/opengraph-image`
    );

    return {
      title: `${landing.baseModel.name} ${landing.stylePreset.name} ideas | NeotypeLab`,
      description,
      alternates: {
        canonical: `/${params.baseModelSlug}/${params.stylePresetSlug}`,
      },
      openGraph: {
        title: `${landing.baseModel.name} ${landing.stylePreset.name} ideas | NeotypeLab`,
        description,
        url: `/${params.baseModelSlug}/${params.stylePresetSlug}`,
        type: "article",
        images: [
          {
            url: shareImageUrl,
            alt: `${landing.baseModel.name} ${landing.stylePreset.name} ideas`,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: `${landing.baseModel.name} ${landing.stylePreset.name} ideas | NeotypeLab`,
        description,
        images: [shareImageUrl],
      },
      keywords: [
        ...landing.stylePreset.seoKeywords,
        `${landing.baseModel.name} ${landing.stylePreset.name}`,
        `${landing.baseModel.name} repaint ideas`,
      ],
    };
  } catch {
    return {
      title: "Style Landing Page | NeotypeLab",
      description: "Public landing page for a base model and Style DNA pairing.",
      alternates: {
        canonical: `/${params.baseModelSlug}/${params.stylePresetSlug}`,
      },
    };
  }
}

export default function SeoLandingPage({
  params,
}: {
  params: { baseModelSlug: string; stylePresetSlug: string };
}) {
  const structuredDataPromise = fetchQuery(api.showcase.getSeoLandingPage, {
    baseModelSlug: params.baseModelSlug,
    stylePresetSlug: params.stylePresetSlug,
  }).then((landing) => {
    if (landing === null) {
      return null;
    }

    const description = [
      `${landing.baseModel.name} repaint ideas`,
      landing.stylePreset.name,
      `${landing.conceptCount} public concept${landing.conceptCount === 1 ? "" : "s"}`,
    ].join(" · ");

    return buildLandingPageStructuredData({
      baseModelSlug: params.baseModelSlug,
      stylePresetSlug: params.stylePresetSlug,
      baseModelName: landing.baseModel.name,
      stylePresetName: landing.stylePreset.name,
      description,
      imageUrl: landing.featuredConcept.previewAsset?.publicUrl,
      conceptCount: landing.conceptCount,
      likeCount: landing.aggregate.likes,
      saveCount: landing.aggregate.saves,
      remixCount: landing.aggregate.remixes,
      seoKeywords: landing.stylePreset.seoKeywords,
    });
  });

  return (
    <div className="min-h-screen bg-[#0D1117] px-4 py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <LandingStructuredData structuredDataPromise={structuredDataPromise} />
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-white/10 bg-[#11161D]/95 px-6 py-4 text-[#E6EDF3] backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#58FFB2]">NeotypeLab Public</p>
            <h1 className="mt-2 text-lg font-semibold">Style landing page</h1>
          </div>
          <div className="flex gap-3">
            <Link
              href="/showcase"
              className="inline-flex h-10 items-center justify-center rounded-[16px] border border-white/10 px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-white/5"
            >
              Showcase
            </Link>
            <Link
              href="/t/create"
              className="inline-flex h-10 items-center justify-center rounded-[16px] border border-[#3DD9FF]/35 bg-[#0E2430] px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-[#123342]"
            >
              Open Terminal
            </Link>
          </div>
        </div>
        <SeoLandingPageView
          baseModelSlug={params.baseModelSlug}
          stylePresetSlug={params.stylePresetSlug}
        />
      </div>
    </div>
  );
}

async function LandingStructuredData({
  structuredDataPromise,
}: {
  structuredDataPromise: Promise<ReturnType<typeof buildLandingPageStructuredData> | null>;
}) {
  const structuredData = await structuredDataPromise;
  if (structuredData === null) {
    return null;
  }
  return <JsonLdScript data={structuredData} />;
}
