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
import { createConvexHttpClient } from "@/src/lib/convexServer";
import { absoluteUrl } from "@/lib/site";
import { buildPrototypeStructuredData } from "@/lib/structuredData";

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
          "VITE_CONVEX_URL is required for SSR Convex reads.",
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
            "This prototype is no longer available on a public or unlisted share surface.",
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
          "Prototype data could not be loaded from Convex. Confirm the share id and deployment environment.",
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
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: meta.title },
        { name: "twitter:description", content: meta.description },
        ...imageMeta,
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
    <AppShell title="Shared prototype">
      <main className="prototype-page">
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
    title: "Shared Prototype | NeotypeLab",
    description: "Shared mecha repaint prototype and paint mapping surface.",
    canonicalPath: `/prototype/${conceptId}`,
  };
}

function buildPrototypeMeta(
  conceptId: string,
  concept: SharedPrototype
): PrototypeMeta {
  return {
    title: `${concept.title} | NeotypeLab`,
    description: buildPrototypeDescription(concept),
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
  return [
    concept.baseModel?.name ?? "Unknown base model",
    concept.stylePreset?.name ?? "Unknown Style DNA",
    concept.materialPreset?.name ?? "Unknown material profile",
  ].join(" / ");
}
