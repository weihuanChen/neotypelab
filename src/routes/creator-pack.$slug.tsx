import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import { absoluteUrl } from "@/lib/site";
import { buildCreatorPackStructuredData } from "@/lib/structuredData";
import { AppShell } from "@/src/components/app-shell/AppShell";
import {
  CreatorPackView,
  PublicUnavailable,
} from "@/src/components/public/PublicRouteViews";
import type {
  CreatorPackData,
  CreatorPackSnapshot,
  PublicRouteMeta,
} from "@/src/components/public/types";
import { createConvexHttpClient } from "@/src/lib/convexServer";

const getCreatorPackSnapshot = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string() }))
  .handler(async ({ data }): Promise<CreatorPackSnapshot> => {
    const meta = buildFallbackCreatorPackMeta(data.slug);
    const convex = createConvexHttpClient();

    if (!convex) {
      return {
        status: "missing-env",
        pack: null,
        message:
          "NEXT_PUBLIC_CONVEX_URL or VITE_CONVEX_URL is required for SSR Convex reads.",
        meta,
        structuredData: null,
      };
    }

    try {
      const pack = await convex.query(api.showcase.getCreatorPackBySlug, {
        slug: data.slug,
      });

      if (pack === null) {
        return {
          status: "not-found",
          pack: null,
          message:
            "The selected creator pack may be inactive or not yet configured for a public surface.",
          meta,
          structuredData: null,
        };
      }

      return {
        status: "ok",
        pack,
        generatedAt: new Date().toISOString(),
        meta: buildCreatorPackMeta(pack),
        structuredData: buildCreatorPackJsonLd(pack),
      };
    } catch {
      return {
        status: "error",
        pack: null,
        message:
          "Creator pack data could not be loaded from Convex. Confirm the slug and deployment environment.",
        meta,
        structuredData: null,
      };
    }
  });

export const Route = createFileRoute("/creator-pack/$slug")({
  loader: ({ params }) => getCreatorPackSnapshot({ data: { slug: params.slug } }),
  head: ({ loaderData, params }) =>
    buildHead(loaderData?.meta ?? buildFallbackCreatorPackMeta(params.slug), "article"),
  component: CreatorPackRoute,
});

function CreatorPackRoute() {
  const snapshot = Route.useLoaderData();

  return (
    <AppShell title="Creator pack">
      <main className="public-page">
        <StructuredData data={snapshot.structuredData} />
        {snapshot.pack ? (
          <CreatorPackView pack={snapshot.pack} />
        ) : (
          <PublicUnavailable
            message={snapshot.message}
            title="This creator pack is not available."
          />
        )}
      </main>
    </AppShell>
  );
}

function buildFallbackCreatorPackMeta(slug: string): PublicRouteMeta {
  return {
    title: "Creator Pack | NeotypeLab",
    description:
      "Curated creator pack for Style DNA, base models, and material presets.",
    canonicalPath: `/creator-pack/${slug}`,
  };
}

function buildCreatorPackMeta(pack: CreatorPackData): PublicRouteMeta {
  return {
    title: `${pack.name} | NeotypeLab`,
    description: buildCreatorPackDescription(pack),
    canonicalPath: `/creator-pack/${pack.slug}`,
    imageUrl: absoluteUrl(`/creator-pack/${pack.slug}/opengraph-image`),
  };
}

function buildCreatorPackJsonLd(pack: CreatorPackData) {
  return buildCreatorPackStructuredData({
    slug: pack.slug,
    name: pack.name,
    description: buildCreatorPackDescription(pack),
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
}

function buildCreatorPackDescription(pack: CreatorPackData) {
  return (
    pack.description ??
    `${pack.styles.length} styles / ${pack.baseModels.length} base models / ${pack.materials.length} materials`
  );
}

function StructuredData({ data }: { data: unknown }) {
  return data ? (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  ) : null;
}

function buildHead(meta: PublicRouteMeta, ogType: string) {
  const imageMeta = meta.imageUrl
    ? [
        { property: "og:image", content: meta.imageUrl },
        { name: "twitter:image", content: meta.imageUrl },
      ]
    : [];

  return {
    meta: [
      { title: meta.title },
      { name: "description", content: meta.description },
      { property: "og:title", content: meta.title },
      { property: "og:description", content: meta.description },
      { property: "og:url", content: meta.canonicalPath },
      { property: "og:type", content: ogType },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: meta.title },
      { name: "twitter:description", content: meta.description },
      ...imageMeta,
    ],
    links: [{ rel: "canonical", href: meta.canonicalPath }],
  };
}
