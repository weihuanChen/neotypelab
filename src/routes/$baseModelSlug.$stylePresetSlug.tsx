import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import { absoluteUrl } from "@/lib/site";
import { buildLandingPageStructuredData } from "@/lib/structuredData";
import { AppShell } from "@/src/components/app-shell/AppShell";
import {
  PublicUnavailable,
  SeoLandingView,
} from "@/src/components/public/PublicRouteViews";
import type {
  PublicRouteMeta,
  SeoLandingData,
  SeoLandingSnapshot,
} from "@/src/components/public/types";
import { createConvexHttpClient } from "@/src/lib/convexServer";

const getSeoLandingSnapshot = createServerFn({ method: "GET" })
  .validator(z.object({ baseModelSlug: z.string(), stylePresetSlug: z.string() }))
  .handler(async ({ data }): Promise<SeoLandingSnapshot> => {
    const meta = buildFallbackSeoLandingMeta(
      data.baseModelSlug,
      data.stylePresetSlug
    );
    const convex = createConvexHttpClient();

    if (!convex) {
      return {
        status: "missing-env",
        landing: null,
        message:
          "NEXT_PUBLIC_CONVEX_URL or VITE_CONVEX_URL is required for SSR Convex reads.",
        meta,
        structuredData: null,
      };
    }

    try {
      const landing = await convex.query(api.showcase.getSeoLandingPage, {
        baseModelSlug: data.baseModelSlug,
        stylePresetSlug: data.stylePresetSlug,
      });

      if (landing === null) {
        return {
          status: "not-found",
          landing: null,
          message:
            "This base model and Style DNA combination does not yet have a public showcase surface.",
          meta,
          structuredData: null,
        };
      }

      return {
        status: "ok",
        landing,
        generatedAt: new Date().toISOString(),
        meta: buildSeoLandingMeta(
          data.baseModelSlug,
          data.stylePresetSlug,
          landing
        ),
        structuredData: buildSeoLandingJsonLd(
          data.baseModelSlug,
          data.stylePresetSlug,
          landing
        ),
      };
    } catch {
      return {
        status: "error",
        landing: null,
        message:
          "Style landing data could not be loaded from Convex. Confirm the slugs and deployment environment.",
        meta,
        structuredData: null,
      };
    }
  });

export const Route = createFileRoute("/$baseModelSlug/$stylePresetSlug")({
  loader: ({ params }) =>
    getSeoLandingSnapshot({
      data: {
        baseModelSlug: params.baseModelSlug,
        stylePresetSlug: params.stylePresetSlug,
      },
    }),
  head: ({ loaderData, params }) => {
    const meta =
      loaderData?.meta ??
      buildFallbackSeoLandingMeta(params.baseModelSlug, params.stylePresetSlug);

    return buildHead(meta, "article");
  },
  component: SeoLandingRoute,
});

function SeoLandingRoute() {
  const snapshot = Route.useLoaderData();

  return (
    <AppShell title="Style landing page">
      <main className="public-page">
        <StructuredData data={snapshot.structuredData} />
        {snapshot.landing ? (
          <SeoLandingView landing={snapshot.landing} />
        ) : (
          <PublicUnavailable
            message={snapshot.message}
            title="This landing page is not available."
          />
        )}
      </main>
    </AppShell>
  );
}

function buildFallbackSeoLandingMeta(
  baseModelSlug: string,
  stylePresetSlug: string
): PublicRouteMeta {
  return {
    title: "Style Landing Page | NeotypeLab",
    description:
      "Public landing page for a base model and Style DNA pairing.",
    canonicalPath: `/${baseModelSlug}/${stylePresetSlug}`,
  };
}

function buildSeoLandingMeta(
  baseModelSlug: string,
  stylePresetSlug: string,
  landing: SeoLandingData
): PublicRouteMeta {
  const title = `${landing.baseModel.name} ${landing.stylePreset.name} ideas | NeotypeLab`;

  return {
    title,
    description: buildSeoLandingDescription(landing),
    canonicalPath: `/${baseModelSlug}/${stylePresetSlug}`,
    imageUrl: absoluteUrl(
      `/${baseModelSlug}/${stylePresetSlug}/opengraph-image`
    ),
  };
}

function buildSeoLandingJsonLd(
  baseModelSlug: string,
  stylePresetSlug: string,
  landing: SeoLandingData
) {
  return buildLandingPageStructuredData({
    baseModelSlug,
    stylePresetSlug,
    baseModelName: landing.baseModel.name,
    stylePresetName: landing.stylePreset.name,
    description: buildSeoLandingDescription(landing),
    imageUrl: landing.featuredConcept.previewAsset?.publicUrl,
    conceptCount: landing.conceptCount,
    likeCount: landing.aggregate.likes,
    saveCount: landing.aggregate.saves,
    remixCount: landing.aggregate.remixes,
    seoKeywords: landing.stylePreset.seoKeywords,
  });
}

function buildSeoLandingDescription(landing: SeoLandingData) {
  return [
    `${landing.baseModel.name} repaint ideas`,
    landing.stylePreset.name,
    `${landing.conceptCount} public concept${landing.conceptCount === 1 ? "" : "s"}`,
  ].join(" / ");
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
