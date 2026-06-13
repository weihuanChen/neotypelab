import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { createConvexHttpClient } from "@/src/lib/convexServer";
import { openGraphImageResponse } from "@/src/lib/og";

export const Route = createFileRoute("/prototype_/$conceptId/opengraph-image")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const convex = createConvexHttpClient();
        const concept = convex
          ? await convex
              .query(api.showcase.getSharedConcept, {
                conceptId: params.conceptId as Id<"concepts">,
              })
              .catch(() => null)
          : null;

        return openGraphImageResponse({
          accent: "#58FFB2",
          eyebrow: "Prototype Share Surface",
          title: concept?.title ?? "Shared prototype unavailable",
          subtitle: concept
            ? `${concept.baseModel?.name ?? "Unknown base model"} / ${concept.stylePreset?.name ?? "Unknown Style DNA"} / ${concept.materialPreset?.name ?? "Unknown material profile"}`
            : "This shared prototype is no longer available on a public or unlisted surface.",
          meta: concept
            ? [
                concept.weatheringLevel,
                `${concept.engagement.likeCount} likes`,
                `${concept.remixCount} remixes`,
              ]
            : ["Unavailable", "NeotypeLab"],
          footer: concept?.owner
            ? `Pilot @${concept.owner.handle} / Built for remix and public discovery`
            : "NeotypeLab public concept surface",
          imageUrl: concept?.previewAsset?.publicUrl,
        });
      },
    },
  },
});
