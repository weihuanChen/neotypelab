import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import Link from "next/link";
import { JsonLdScript } from "@/components/helpers/JsonLdScript";
import { api } from "@/convex/_generated/api";
import { absoluteUrl } from "@/lib/site";
import { buildCreatorPackStructuredData } from "@/lib/structuredData";
import { CreatorPackPageView } from "./CreatorPackPageView";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  try {
    const pack = await fetchQuery(api.showcase.getCreatorPackBySlug, {
      slug: params.slug,
    });

    if (pack === null) {
      return {
        title: "Creator Pack | NeotypeLab",
        description: "This creator pack is not currently available.",
        alternates: {
          canonical: `/creator-pack/${params.slug}`,
        },
      };
    }

    const description =
      pack.description ??
      `${pack.styles.length} styles · ${pack.baseModels.length} base models · ${pack.materials.length} materials`;
    const shareImageUrl = absoluteUrl(`/creator-pack/${params.slug}/opengraph-image`);

    return {
      title: `${pack.name} | NeotypeLab`,
      description,
      alternates: {
        canonical: `/creator-pack/${params.slug}`,
      },
      openGraph: {
        title: `${pack.name} | NeotypeLab`,
        description,
        url: `/creator-pack/${params.slug}`,
        type: "article",
        images: [
          {
            url: shareImageUrl,
            alt: pack.name,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: `${pack.name} | NeotypeLab`,
        description,
        images: [shareImageUrl],
      },
    };
  } catch {
    return {
      title: "Creator Pack | NeotypeLab",
      description: "Curated creator pack for Style DNA, base models, and material presets.",
      alternates: {
        canonical: `/creator-pack/${params.slug}`,
      },
    };
  }
}

export default function CreatorPackPage({
  params,
}: {
  params: { slug: string };
}) {
  const structuredDataPromise = fetchQuery(api.showcase.getCreatorPackBySlug, {
    slug: params.slug,
  }).then((pack) => {
    if (pack === null) {
      return null;
    }

    return buildCreatorPackStructuredData({
      slug: pack.slug,
      name: pack.name,
      description:
        pack.description ??
        `${pack.styles.length} styles · ${pack.baseModels.length} base models · ${pack.materials.length} materials`,
      creatorHandle: pack.creator.handle,
      creatorName: pack.creator.fullName,
      imageUrl: pack.concepts[0]?.previewAsset?.publicUrl ?? pack.creator.pictureUrl,
      styleCount: pack.styles.length,
      baseModelCount: pack.baseModels.length,
      materialCount: pack.materials.length,
      packType: pack.packType,
      likeCount: pack.engagement.likeCount,
      saveCount: pack.engagement.saveCount,
    });
  });

  return (
    <div className="min-h-screen bg-[#0D1117] px-4 py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <CreatorPackStructuredData structuredDataPromise={structuredDataPromise} />
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-white/10 bg-[#11161D]/95 px-6 py-4 text-[#E6EDF3] backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#58FFB2]">NeotypeLab Public</p>
            <h1 className="mt-2 text-lg font-semibold">Creator pack</h1>
          </div>
          <div className="flex gap-3">
            <Link
              href="/showcase"
              className="inline-flex h-10 items-center justify-center rounded-[16px] border border-white/10 px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-white/10"
            >
              Showcase
            </Link>
            <Link
              href="/t/create"
              className="inline-flex h-10 items-center justify-center rounded-[16px] border border-[#3DD9FF]/35 bg-[#0E2430] px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-white/10"
            >
              Open Terminal
            </Link>
          </div>
        </div>
        <CreatorPackPageBody slug={params.slug} />
      </div>
    </div>
  );
}

async function CreatorPackPageBody({ slug }: { slug: string }) {
  const pack = await fetchQuery(api.showcase.getCreatorPackBySlug, { slug });

  if (pack === null) {
    return (
      <section className="rounded-[28px] border border-white/10 bg-[#161B22] p-8 text-[#E6EDF3]">
        <p className="text-xs uppercase tracking-[0.3em] text-[#FFB84D]">Unavailable</p>
        <h1 className="mt-4 text-3xl font-semibold">This creator pack is not available.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#9BA7B4]">
          The selected creator pack may be inactive or not yet configured for a public surface.
        </p>
      </section>
    );
  }

  return <CreatorPackPageView pack={pack} />;
}

async function CreatorPackStructuredData({
  structuredDataPromise,
}: {
  structuredDataPromise: Promise<ReturnType<typeof buildCreatorPackStructuredData> | null>;
}) {
  const structuredData = await structuredDataPromise;
  if (structuredData === null) {
    return null;
  }
  return <JsonLdScript data={structuredData} />;
}
