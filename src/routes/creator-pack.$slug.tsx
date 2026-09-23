import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import { absoluteUrl } from "@/lib/site";
import { buildCreatorPackStructuredData } from "@/lib/structuredData";
import { creatorPackSeo, documentMeta } from "@/src/lib/publicSeo";
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
          "NeotypeLab could not load this page just now.",
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
            "This color pack is inactive, or it is not public yet.",
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
          "This color pack could not be loaded. Try again in a moment.",
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
    title: "Gunpla Paint Pack | NeotypeLab",
    description:
      "A curated pack of Gunpla and mecha model color directions, kits, and paint finishes to preview before you spray.",
    keywords: "gunpla paint, custom gunpla, mecha model kit",
    canonicalPath: `/creator-pack/${slug}`,
  };
}

function buildCreatorPackMeta(pack: CreatorPackData): PublicRouteMeta {
  const copy = creatorPackSeo({
    name: pack.name,
    description: pack.description,
    styles: pack.styles.length,
    baseModels: pack.baseModels.length,
    materials: pack.materials.length,
  });

  return {
    title: copy.title,
    description: copy.description,
    keywords: copy.keywords,
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
  return creatorPackSeo({
    name: pack.name,
    description: pack.description,
    styles: pack.styles.length,
    baseModels: pack.baseModels.length,
    materials: pack.materials.length,
  }).description;
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
  return {
    meta: documentMeta(
      {
        title: meta.title,
        description: meta.description,
        keywords: meta.keywords ?? "gunpla paint, custom gunpla, mecha model kit",
      },
      { ogType, twitter: true, imageUrl: meta.imageUrl, url: meta.canonicalPath },
    ),
    links: [{ rel: "canonical", href: meta.canonicalPath }],
  };
}
