import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import { absoluteUrl } from "@/lib/site";
import { buildCreatorHubStructuredData } from "@/lib/structuredData";
import { creatorHubSeo, documentMeta } from "@/src/lib/publicSeo";
import { AppShell } from "@/src/components/app-shell/AppShell";
import {
  CreatorHubView,
  PublicUnavailable,
} from "@/src/components/public/PublicRouteViews";
import type {
  CreatorHubData,
  CreatorHubSnapshot,
  PublicRouteMeta,
} from "@/src/components/public/types";
import { createConvexHttpClient } from "@/src/lib/convexServer";

const getCreatorHubSnapshot = createServerFn({ method: "GET" })
  .validator(z.object({ handle: z.string() }))
  .handler(async ({ data }): Promise<CreatorHubSnapshot> => {
    const handle = normalizeHandle(data.handle);
    const meta = buildFallbackCreatorHubMeta(handle);
    const convex = createConvexHttpClient();

    if (!convex) {
      return {
        status: "missing-env",
        profile: null,
        message:
          "NeotypeLab could not load this page just now.",
        meta,
        structuredData: null,
      };
    }

    try {
      const profile = await convex.query(api.showcase.getPublicProfile, {
        handle,
      });

      if (profile === null) {
        return {
          status: "not-found",
          profile: null,
          message:
            "This builder does not have a public hub yet.",
          meta,
          structuredData: null,
        };
      }

      return {
        status: "ok",
        profile,
        generatedAt: new Date().toISOString(),
        meta: buildCreatorHubMeta(profile),
        structuredData: buildCreatorHubJsonLd(profile),
      };
    } catch {
      return {
        status: "error",
        profile: null,
        message:
          "This creator hub could not be loaded. Check the name and try again.",
        meta,
        structuredData: null,
      };
    }
  });

export const Route = createFileRoute("/creator/$handle")({
  loader: ({ params }) =>
    getCreatorHubSnapshot({ data: { handle: params.handle } }),
  head: ({ loaderData, params }) =>
    buildHead(
      loaderData?.meta ?? buildFallbackCreatorHubMeta(normalizeHandle(params.handle)),
      "profile"
    ),
  component: CreatorHubRoute,
});

function CreatorHubRoute() {
  const snapshot = Route.useLoaderData();

  return (
    <AppShell title="Creator hub">
      <main className="public-page">
        <StructuredData data={snapshot.structuredData} />
        {snapshot.profile ? (
          <CreatorHubView profile={snapshot.profile} />
        ) : (
          <PublicUnavailable
            message={snapshot.message}
            title="This creator hub is not available."
          />
        )}
      </main>
    </AppShell>
  );
}

function buildFallbackCreatorHubMeta(handle: string): PublicRouteMeta {
  return {
    title: "Gunpla Paint Plans | NeotypeLab",
    description: "A creator hub of spray-ready Gunpla and mecha model paint plans.",
    keywords: "gunpla paint, custom gunpla, mecha model kit",
    canonicalPath: `/creator/${handle}`,
  };
}

function buildCreatorHubMeta(profile: CreatorHubData): PublicRouteMeta {
  const copy = creatorHubSeo({
    fullName: profile.pilot.fullName,
    handle: profile.pilot.handle,
    publicConcepts: profile.totals.publicConcepts,
    creatorPacks: profile.creatorPackCollection.length,
    styles: profile.styleCollection.length,
  });

  return {
    title: copy.title,
    description: copy.description,
    keywords: copy.keywords,
    canonicalPath: `/creator/${profile.pilot.handle}`,
    imageUrl: absoluteUrl(`/creator/${profile.pilot.handle}/opengraph-image`),
  };
}

function buildCreatorHubJsonLd(profile: CreatorHubData) {
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

function normalizeHandle(handle: string) {
  return handle.replace(/^@/, "").trim();
}
