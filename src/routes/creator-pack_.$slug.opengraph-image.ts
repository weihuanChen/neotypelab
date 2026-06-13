import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/convex/_generated/api";
import { createConvexHttpClient } from "@/src/lib/convexServer";
import { openGraphImageResponse } from "@/src/lib/og";

export const Route = createFileRoute("/creator-pack_/$slug/opengraph-image")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const convex = createConvexHttpClient();
        const pack = convex
          ? await convex
              .query(api.showcase.getCreatorPackBySlug, { slug: params.slug })
              .catch(() => null)
          : null;

        return openGraphImageResponse({
          accent: "#3DD9FF",
          eyebrow: "Creator Pack",
          title: pack?.name ?? "Creator pack unavailable",
          subtitle: pack
            ? `${pack.creator.fullName} / ${pack.styles.length} styles / ${pack.baseModels.length} base models`
            : "This creator pack is not currently available on a public surface.",
          meta: pack
            ? [
                `${pack.packType} pack`,
                `${pack.materials.length} materials`,
                `${pack.concepts.length} concepts`,
              ]
            : ["Unavailable", "NeotypeLab"],
          footer: pack
            ? "Curated starter set for creator-owned Style DNA, compatible base models, and material presets"
            : "NeotypeLab creator pack surface",
          imageUrl: pack?.concepts[0]?.previewAsset?.publicUrl ?? pack?.creator.pictureUrl,
        });
      },
    },
  },
});
