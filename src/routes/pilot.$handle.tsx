import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { PilotPublicView } from "@/src/components/pilot/PilotPublicView";
import type {
  PilotMeta,
  PilotSnapshot,
  PublicPilotProfile,
} from "@/src/components/pilot/types";
import { createConvexHttpClient } from "@/src/lib/convexServer";
import { absoluteUrl } from "@/lib/site";
import { buildPilotProfileStructuredData } from "@/lib/structuredData";
import { documentMeta, pilotSeo } from "@/src/lib/publicSeo";

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
            "This builder profile is not public, or the name does not match an account.",
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
          "This builder profile could not be loaded. Check the name and try again.",
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

    return {
      meta: documentMeta(
        { title: meta.title, description: meta.description, keywords: meta.keywords ?? "gunpla paint, custom gunpla, mecha model kit" },
        { ogType: "profile", twitter: true, imageUrl: meta.imageUrl, url: meta.canonicalPath },
      ),
      links: [{ rel: "canonical", href: meta.canonicalPath }],
    };
  },
  component: PilotRoute,
});

function PilotRoute() {
  const snapshot = Route.useLoaderData();
  const handle = getHandleFromSnapshot(snapshot);

  return (
    <AppShell title="Pilot profile">
      <main className="pilot-page">
        {snapshot.structuredData ? (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(snapshot.structuredData),
            }}
          />
        ) : null}
        <PilotPublicView handle={handle} snapshot={snapshot} />
      </main>
    </AppShell>
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
    title: "Gunpla Paint Plans | NeotypeLab",
    description: "A public builder profile of spray-ready Gunpla and mecha model paint plans.",
    keywords: "gunpla paint, custom gunpla, mecha model kit",
    canonicalPath: `/pilot/${handle}`,
  };
}

function buildPilotMeta(profile: PublicPilotProfile): PilotMeta {
  const copy = pilotSeo({
    fullName: profile.pilot.fullName,
    handle: profile.pilot.handle,
    publicConcepts: profile.totals.publicConcepts,
    saves: profile.totals.saves,
    remixes: profile.totals.remixes,
  });

  return {
    title: copy.title,
    description: copy.description,
    keywords: copy.keywords,
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

function normalizeHandle(handle: string) {
  return handle.replace(/^@/, "").trim();
}
