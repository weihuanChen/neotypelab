import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { createConvexHttpClient } from "@/src/lib/convexServer";
import { prototypeExportImageResponse } from "@/src/lib/og";

export const Route = createFileRoute("/prototype_/$conceptId/instagram-image")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const concept = await getSharedConcept(params.conceptId);

        return prototypeExportImageResponse({
          accent: "#F48FD2",
          badge: "Instagram card",
          eyebrow: "Square Export",
          footer: concept?.owner
            ? `Pilot @${concept.owner.handle} / Square showcase card`
            : "NeotypeLab public prototype surface",
          imageUrl: concept?.previewAsset?.publicUrl,
          layout: "square",
          meta: concept
            ? [
                concept.weatheringLevel,
                `${concept.engagement.saveCount} saves`,
                `${concept.remixCount} remixes`,
              ]
            : ["Unavailable", "NeotypeLab"],
          subtitle: concept
            ? `${concept.baseModel?.name ?? "Unknown base model"} / ${concept.stylePreset?.name ?? "Unknown Style DNA"}`
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
