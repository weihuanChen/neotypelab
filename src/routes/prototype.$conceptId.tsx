import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { PrototypePublicView } from "@/src/components/prototype/PrototypePublicView";
import type {
  PrototypeMeta,
  PrototypeSnapshot,
  SharedPrototype,
} from "@/src/components/prototype/types";
import { absoluteUrl } from "@/lib/site";
import { buildPrototypeStructuredData } from "@/lib/structuredData";
import { createConvexHttpClient } from "@/src/lib/convexServer";
import { documentMeta, prototypeSeo } from "@/src/lib/publicSeo";

const getPrototypeSnapshot = createServerFn({ method: "GET" })
  .validator(z.object({ conceptId: z.string() }))
  .handler(async ({ data }): Promise<PrototypeSnapshot> => {
    const meta = buildFallbackPrototypeMeta(data.conceptId);
    const convex = createConvexHttpClient();

    if (!convex) {
      return {
        status: "missing-env",
        concept: null,
        message:
          "NeotypeLab could not load this page just now.",
        meta,
        structuredData: null,
      };
    }

    try {
      const concept = await convex.query(api.showcase.getSharedConcept, {
        conceptId: data.conceptId as Id<"concepts">,
      });

      if (concept === null) {
        return {
          status: "not-found",
          concept: null,
          message:
            "This paint plan is private, missing, or no longer shared.",
          meta,
          structuredData: null,
        };
      }

      return {
        status: "ok",
        concept,
        generatedAt: new Date().toISOString(),
        meta: buildPrototypeMeta(data.conceptId, concept),
        structuredData: buildPrototypeJsonLd(data.conceptId, concept),
      };
    } catch {
      return {
        status: "error",
        concept: null,
        message:
          "This paint plan could not be loaded. Try again in a moment.",
        meta,
        structuredData: null,
      };
    }
  });

export const Route = createFileRoute("/prototype/$conceptId")({
  loader: ({ params }) =>
    getPrototypeSnapshot({ data: { conceptId: params.conceptId } }),
  head: ({ loaderData, params }) => {
    const meta = loaderData?.meta ?? buildFallbackPrototypeMeta(params.conceptId);

    return {
      meta: [
        { name: "robots", content: loaderData?.concept?.indexable ? "index, follow" : "noindex, follow" },
        ...documentMeta(
          { title: meta.title, description: meta.description, keywords: meta.keywords ?? "gunpla paint, custom gunpla, mecha model kit" },
          { ogType: "article", twitter: true, imageUrl: meta.imageUrl, url: meta.canonicalPath },
        ),
      ],
      links: [{ rel: "canonical", href: meta.canonicalPath }],
    };
  },
  component: PrototypeRoute,
});

function PrototypeRoute() {
  const snapshot = Route.useLoaderData();
  const conceptId = getConceptIdFromSnapshot(snapshot);

  return (
    <AppShell title="Public case">
      <main className="case-page">
        {snapshot.structuredData ? (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(snapshot.structuredData),
            }}
          />
        ) : null}
        <PrototypePublicView conceptId={conceptId} snapshot={snapshot} />
      </main>
    </AppShell>
  );
}

function getConceptIdFromSnapshot(snapshot: PrototypeSnapshot) {
  const prefix = "/prototype/";

  return snapshot.meta.canonicalPath.startsWith(prefix)
    ? snapshot.meta.canonicalPath.slice(prefix.length)
    : snapshot.meta.canonicalPath;
}

function buildFallbackPrototypeMeta(conceptId: string): PrototypeMeta {
  return {
    title: "Shared Gunpla Paint Plan | NeotypeLab",
    description:
      "A shared spray-ready Gunpla or mecha model paint plan, with its color layout and paint mapping.",
    keywords: "gunpla paint, custom gunpla, mecha model kit",
    canonicalPath: `/prototype/${conceptId}`,
  };
}

function buildPrototypeMeta(
  conceptId: string,
  concept: SharedPrototype
): PrototypeMeta {
  const copy = prototypeSeo({
    title: concept.title,
    baseModelName: concept.baseModel?.name,
    styleName: concept.stylePreset?.name,
    materialName: concept.materialPreset?.name,
  });

  return {
    title: copy.title,
    description: copy.description,
    keywords: copy.keywords,
    canonicalPath: `/prototype/${conceptId}`,
    imageUrl: absoluteUrl(`/prototype/${conceptId}/opengraph-image`),
  };
}

function buildPrototypeJsonLd(conceptId: string, concept: SharedPrototype) {
  return buildPrototypeStructuredData({
    conceptId,
    title: concept.title,
    description: buildPrototypeDescription(concept),
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
}

function buildPrototypeDescription(concept: SharedPrototype) {
  return prototypeSeo({
    title: concept.title,
    baseModelName: concept.baseModel?.name,
    styleName: concept.stylePreset?.name,
    materialName: concept.materialPreset?.name,
  }).description;
}
