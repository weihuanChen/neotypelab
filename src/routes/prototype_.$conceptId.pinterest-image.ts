import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getSiteUrl } from "@/lib/site";
import { createConvexHttpClient } from "@/src/lib/convexServer";
import { prototypeExportImageResponse } from "@/src/lib/og";

export const Route = createFileRoute("/prototype_/$conceptId/pinterest-image")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const concept = await getSharedConcept(params.conceptId);
        const shareUrl = new URL(
          `/prototype/${params.conceptId}`,
          getSiteUrl(request)
        ).toString();

        return prototypeExportImageResponse({
          accent: "#2C6194",
          badge: "Pinterest card",
          eyebrow: "Pinterest Export",
          footer: concept?.owner
            ? `Pilot @${concept.owner.handle} / Saved reference card`
            : "NeotypeLab public prototype surface",
          imageUrl: concept?.previewAsset?.publicUrl,
          layout: "portrait",
          meta: concept
            ? [
                concept.weatheringLevel,
                `${concept.engagement.saveCount} saves`,
                `${concept.engagement.likeCount} likes`,
              ]
            : ["Unavailable", "NeotypeLab"],
          shareUrl,
          subtitle: concept
            ? `${concept.baseModel?.name ?? "Unknown base model"} / ${concept.stylePreset?.name ?? "Unknown Style DNA"} / ${concept.materialPreset?.name ?? "Unknown material"}`
            : "This shared prototype is no longer available on a public or unlisted surface.",
          title: concept?.title ?? "Shared prototype unavailable",
        });
      },
    },
  },
});

async function getSharedConcept(conceptId: string) {
  const convex = createConvexHttpClient();

  return convex
    ? await convex
        .query(api.showcase.getSharedConcept, {
          conceptId: conceptId as Id<"concepts">,
        })
        .catch(() => null)
    : null;
}
