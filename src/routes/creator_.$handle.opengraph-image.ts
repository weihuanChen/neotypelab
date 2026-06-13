import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/convex/_generated/api";
import { createConvexHttpClient } from "@/src/lib/convexServer";
import { openGraphImageResponse } from "@/src/lib/og";

export const Route = createFileRoute("/creator_/$handle/opengraph-image")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const convex = createConvexHttpClient();
        const handle = params.handle.replace(/^@/, "").trim();
        const profile = convex
          ? await convex
              .query(api.showcase.getPublicProfile, { handle })
              .catch(() => null)
          : null;
        const leadConcept = profile?.published[0] ?? profile?.saved[0] ?? null;

        return openGraphImageResponse({
          accent: "#58FFB2",
          eyebrow: "Creator Hub",
          title: profile?.pilot.fullName ?? "Creator hub unavailable",
          subtitle: profile
            ? `@${profile.pilot.handle} / ${profile.creatorPackCollection.length} packs / ${profile.styleCollection.length} styles`
            : "This creator hub is not currently available on a public surface.",
          meta: profile
            ? [
                `${profile.totals.publicConcepts} concepts`,
                `${profile.totals.remixes} remixes`,
                `${profile.totals.saves} saves`,
              ]
            : ["Unavailable", "NeotypeLab"],
          footer: profile
            ? "Creator hub surface for packs, styles, and public concept output"
            : "NeotypeLab creator hub surface",
          imageUrl: profile?.pilot.pictureUrl ?? leadConcept?.previewAsset?.publicUrl,
        });
      },
    },
  },
});
