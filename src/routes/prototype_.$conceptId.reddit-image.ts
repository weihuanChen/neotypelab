import { createFileRoute } from "@tanstack/react-router";
import { getSiteUrl } from "@/lib/site";
import { getPublicConcept, unavailablePublicConceptResponse } from "@/src/lib/publicConceptServer";
import { prototypeExportImageResponse } from "@/src/lib/og";

export const Route = createFileRoute("/prototype_/$conceptId/reddit-image")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const result = await getPublicConcept(params.conceptId);
        const unavailable = unavailablePublicConceptResponse(result);
        if (unavailable) return unavailable;
        if (result.status !== "ok") throw new Error("Unexpected public concept state");
        const concept = result.concept;
        const shareUrl = new URL(
          `/prototype/${params.conceptId}`,
          getSiteUrl(request)
        ).toString();

        const response = prototypeExportImageResponse({
          accent: "#61C6FF",
          badge: "Reddit card",
          eyebrow: "Reddit Export",
          footer: concept.owner
            ? `Pilot @${concept.owner.handle} / Built for discussion and remix`
            : "NeotypeLab public concept surface",
          imageUrl: concept.previewAsset?.publicUrl,
          layout: "wide",
          meta: [
            concept.weatheringLevel,
            `${concept.engagement.likeCount} likes`,
            `${concept.remixCount} remixes`,
          ],
          shareUrl,
          subtitle: `${concept.baseModel?.name ?? "Unknown base model"} / ${concept.stylePreset?.name ?? "Unknown Style DNA"} / ${concept.materialPreset?.name ?? "Unknown material"}`,
          title: concept.title,
        });
        response.headers.set("Cache-Control", "no-store");
        if (!concept.indexable) response.headers.set("X-Robots-Tag", "noindex");
        return response;
      },
    },
  },
});
