import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/convex/_generated/api";
import { createConvexHttpClient } from "@/src/lib/convexServer";
import { openGraphImageResponse } from "@/src/lib/og";

export const Route = createFileRoute(
  "/$baseModelSlug/$stylePresetSlug/opengraph-image"
)({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const convex = createConvexHttpClient();
        const landing = convex
          ? await convex
              .query(api.showcase.getSeoLandingPage, {
                baseModelSlug: params.baseModelSlug,
                stylePresetSlug: params.stylePresetSlug,
              })
              .catch(() => null)
          : null;

        return openGraphImageResponse({
          accent: "#3DD9FF",
          eyebrow: "Style Landing Page",
          title: landing
            ? `${landing.baseModel.name} in ${landing.stylePreset.name}`
            : "Style landing page unavailable",
          subtitle: landing
            ? `${landing.conceptCount} public concept${landing.conceptCount === 1 ? "" : "s"} / ${landing.aggregate.saves} saves / ${landing.aggregate.remixes} remix branches`
            : "This base model and Style DNA pairing does not yet have a public showcase surface.",
          meta: landing
            ? [
                landing.baseModel.grade ?? "Unknown grade",
                landing.stylePreset.category ?? "Uncategorized",
                `${landing.aggregate.likes} likes`,
              ]
            : ["Unavailable", "NeotypeLab"],
          footer: landing
            ? "Public reference surface for style discovery, sharing, and remix entry"
            : "NeotypeLab SEO landing surface",
          imageUrl: landing?.featuredConcept.previewAsset?.publicUrl,
        });
      },
    },
  },
});
