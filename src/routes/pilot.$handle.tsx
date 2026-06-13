import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import { PilotPublicView } from "@/src/components/pilot/PilotPublicView";
import type {
  PilotMeta,
  PilotSnapshot,
  PublicPilotProfile,
} from "@/src/components/pilot/types";
import { createConvexHttpClient } from "@/src/lib/convexServer";
import { absoluteUrl } from "@/lib/site";
import { buildPilotProfileStructuredData } from "@/lib/structuredData";

const getPilotSnapshot = createServerFn({ method: "GET" })
  .validator(z.object({ handle: z.string() }))
  .handler(async ({ data }): Promise<PilotSnapshot> => {
    const handle = normalizeHandle(data.handle);
    const meta = buildFallbackPilotMeta(handle);
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
            "This pilot profile is not currently available on a public surface.",
          meta,
          structuredData: null,
        };
      }

      return {
        status: "ok",
        profile,
        generatedAt: new Date().toISOString(),
        meta: buildPilotMeta(profile),
        structuredData: buildPilotJsonLd(profile),
      };
    } catch {
      return {
        status: "error",
        profile: null,
        message:
          "Pilot profile data could not be loaded from Convex. Confirm the handle and deployment environment.",
        meta,
        structuredData: null,
      };
    }
  });

export const Route = createFileRoute("/pilot/$handle")({
  loader: ({ params }) =>
    getPilotSnapshot({ data: { handle: params.handle } }),
  head: ({ loaderData, params }) => {
    const handle = normalizeHandle(params.handle);
    const meta = loaderData?.meta ?? buildFallbackPilotMeta(handle);
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
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: meta.title },
        { name: "twitter:description", content: meta.description },
        ...imageMeta,
      ],
      links: [{ rel: "canonical", href: meta.canonicalPath }],
    };
  },
  component: PilotRoute,
});

function PilotRoute() {
  const snapshot = Route.useLoaderData();
  const handle = getHandleFromSnapshot(snapshot);

  return (
    <main className="pilot-page">
      {snapshot.structuredData ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(snapshot.structuredData),
          }}
        />
      ) : null}
      <section className="showcase-topbar">
        <div>
          <p className="showcase-kicker">NeotypeLab Public</p>
          <h1>Pilot profile</h1>
        </div>
        <div className="showcase-topbar__actions">
          <a className="showcase-button is-ghost" href="/showcase">
            Showcase
          </a>
          <a className="showcase-button" href="/t/library">
            Open Terminal
          </a>
        </div>
      </section>
      <PilotPublicView handle={handle} snapshot={snapshot} />
    </main>
  );
}

function getHandleFromSnapshot(snapshot: PilotSnapshot) {
  const prefix = "/pilot/";

  return snapshot.meta.canonicalPath.startsWith(prefix)
    ? snapshot.meta.canonicalPath.slice(prefix.length)
    : snapshot.meta.canonicalPath;
}

function buildFallbackPilotMeta(handle: string): PilotMeta {
  return {
    title: "Pilot Profile | NeotypeLab",
    description: "Public pilot profile surface for NeotypeLab concepts.",
    canonicalPath: `/pilot/${handle}`,
  };
}

function buildPilotMeta(profile: PublicPilotProfile): PilotMeta {
  return {
    title: `${profile.pilot.fullName} (@${profile.pilot.handle}) | NeotypeLab`,
    description: buildPilotDescription(profile),
    canonicalPath: `/pilot/${profile.pilot.handle}`,
    imageUrl: absoluteUrl(`/pilot/${profile.pilot.handle}/opengraph-image`),
  };
}

function buildPilotJsonLd(profile: PublicPilotProfile) {
  return buildPilotProfileStructuredData({
    handle: profile.pilot.handle,
    fullName: profile.pilot.fullName,
    imageUrl: profile.pilot.pictureUrl,
    publicConceptCount: profile.totals.publicConcepts,
    totalLikes: profile.totals.likes,
    totalSaves: profile.totals.saves,
    totalRemixes: profile.totals.remixes,
  });
}

function buildPilotDescription(profile: PublicPilotProfile) {
  return [
    `${profile.totals.publicConcepts} public concepts`,
    `${profile.totals.saves} saves`,
    `${profile.totals.remixes} remix branches`,
  ].join(" / ");
}

function normalizeHandle(handle: string) {
  return handle.replace(/^@/, "").trim();
}
