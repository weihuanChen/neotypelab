import { createFileRoute } from "@tanstack/react-router";
import { getSiteUrl } from "@/lib/site";
import { getPublicConcept, unavailablePublicConceptResponse } from "@/src/lib/publicConceptServer";
import { prototypeExportImageResponse } from "@/src/lib/og";

export const Route = createFileRoute("/prototype_/$conceptId/instagram-image")({
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
          accent: "#F48FD2",
          badge: "Instagram card",
          eyebrow: "Square Export",
          footer: concept.owner
            ? `Pilot @${concept.owner.handle} / Square showcase card`
            : "NeotypeLab public prototype surface",
          imageUrl: concept.previewAsset?.publicUrl,
          layout: "square",
          meta: [
            concept.weatheringLevel,
            `${concept.engagement.saveCount} saves`,
            `${concept.remixCount} remixes`,
          ],
          shareUrl,
          subtitle: `${concept.baseModel?.name ?? "Unknown base model"} / ${concept.stylePreset?.name ?? "Unknown Style DNA"}`,
          title: concept.title,
        });
        response.headers.set("Cache-Control", "no-store");
        if (!concept.indexable) response.headers.set("X-Robots-Tag", "noindex");
        return response;
      },
    },
  },
});
