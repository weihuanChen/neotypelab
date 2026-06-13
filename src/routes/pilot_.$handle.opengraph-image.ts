import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/convex/_generated/api";
import { createConvexHttpClient } from "@/src/lib/convexServer";
import { openGraphImageResponse } from "@/src/lib/og";

export const Route = createFileRoute("/pilot_/$handle/opengraph-image")({
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
          accent: "#FFB84D",
          eyebrow: "Pilot Profile",
          title: profile?.pilot.fullName ?? "Pilot profile unavailable",
          subtitle: profile
            ? `@${profile.pilot.handle} / ${profile.totals.publicConcepts} public concepts / ${profile.totals.remixes} remix branches`
            : "This pilot profile is not currently available on a public surface.",
          meta: profile
            ? [
                `${profile.totals.likes} likes`,
                `${profile.totals.saves} saves`,
                `${profile.totals.publicConcepts} published`,
              ]
            : ["Unavailable", "NeotypeLab"],
          footer: profile
            ? "Public profile surface for published concepts, saves, and remix history"
            : "NeotypeLab public profile surface",
          imageUrl: profile?.pilot.pictureUrl ?? leadConcept?.previewAsset?.publicUrl,
        });
      },
    },
  },
});
