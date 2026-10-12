import { createFileRoute } from "@tanstack/react-router";
import { getPublicConcept, unavailablePublicConceptResponse } from "@/src/lib/publicConceptServer";
import { openGraphImageResponse } from "@/src/lib/og";

export const Route = createFileRoute("/prototype_/$conceptId/opengraph-image")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const result = await getPublicConcept(params.conceptId);
        const unavailable = unavailablePublicConceptResponse(result);
        if (unavailable) return unavailable;
        if (result.status !== "ok") throw new Error("Unexpected public concept state");
        const concept = result.concept;

        const response = openGraphImageResponse({
          accent: "#58FFB2",
          eyebrow: "Prototype Share Surface",
          title: concept.title,
          subtitle: `${concept.baseModel?.name ?? "Unknown base model"} / ${concept.stylePreset?.name ?? "Unknown Style DNA"} / ${concept.materialPreset?.name ?? "Unknown material profile"}`,
          meta: [
            concept.weatheringLevel,
            `${concept.engagement.likeCount} likes`,
            `${concept.remixCount} remixes`,
          ],
          footer: concept.owner
            ? `Pilot @${concept.owner.handle} / Built for remix and public discovery`
            : "NeotypeLab public concept surface",
          imageUrl: concept.previewAsset?.publicUrl,
        });
        response.headers.set("Cache-Control", "no-store");
        if (!concept.indexable) response.headers.set("X-Robots-Tag", "noindex");
        return response;
      },
    },
  },
});
