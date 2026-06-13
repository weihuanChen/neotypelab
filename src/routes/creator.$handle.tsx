import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import { absoluteUrl } from "@/lib/site";
import { buildCreatorHubStructuredData } from "@/lib/structuredData";
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
          "NEXT_PUBLIC_CONVEX_URL or VITE_CONVEX_URL is required for SSR Convex reads.",
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
            "The selected creator may not yet have enough public activity to support a hub surface.",
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
          "Creator hub data could not be loaded from Convex. Confirm the handle and deployment environment.",
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
    <main className="public-page">
      <StructuredData data={snapshot.structuredData} />
      <PublicTopbar handle={snapshot.profile?.pilot.handle} title="Creator hub" />
      {snapshot.profile ? (
        <CreatorHubView profile={snapshot.profile} />
      ) : (
        <PublicUnavailable
          message={snapshot.message}
          title="This creator hub is not available."
        />
      )}
    </main>
  );
}

function buildFallbackCreatorHubMeta(handle: string): PublicRouteMeta {
  return {
    title: "Creator Hub | NeotypeLab",
    description: "Creator hub surface for packs, styles, and public concepts.",
    canonicalPath: `/creator/${handle}`,
  };
}

function buildCreatorHubMeta(profile: CreatorHubData): PublicRouteMeta {
  return {
    title: `${profile.pilot.fullName} creator hub | NeotypeLab`,
    description: buildCreatorHubDescription(profile),
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

function buildCreatorHubDescription(profile: CreatorHubData) {
  return [
    `${profile.totals.publicConcepts} public concepts`,
    `${profile.creatorPackCollection.length} creator packs`,
    `${profile.styleCollection.length} creator styles`,
  ].join(" / ");
}

function PublicTopbar({
  handle,
  title,
}: {
  handle?: string;
  title: string;
}) {
  return (
    <section className="showcase-topbar">
      <div>
        <p className="showcase-kicker">NeotypeLab Public</p>
        <h1>{title}</h1>
      </div>
      <div className="showcase-topbar__actions">
        <a className="showcase-button is-ghost" href="/showcase">
          Showcase
        </a>
        <a className="showcase-button" href={handle ? `/pilot/${handle}` : "/showcase"}>
          Pilot Profile
        </a>
      </div>
    </section>
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

function normalizeHandle(handle: string) {
  return handle.replace(/^@/, "").trim();
}
