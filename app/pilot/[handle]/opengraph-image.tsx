import { ImageResponse } from "next/og";
import { fetchQuery } from "convex/nextjs";
import { OpenGraphImageCard } from "@/components/helpers/OpenGraphImageCard";
import { api } from "@/convex/_generated/api";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function OpenGraphImage({
  params,
}: {
  params: { handle: string };
}) {
  const profile = await fetchQuery(api.showcase.getPublicProfile, {
    handle: params.handle,
  });

  const leadConcept = profile?.published[0] ?? profile?.saved[0] ?? null;

  return new ImageResponse(
    (
      <OpenGraphImageCard
        accent="#FFB84D"
        eyebrow="Pilot Profile"
        title={profile ? `${profile.pilot.fullName}` : "Pilot profile unavailable"}
        subtitle={
          profile
            ? `@${profile.pilot.handle} · ${profile.totals.publicConcepts} public concepts · ${profile.totals.remixes} remix branches`
            : "This pilot profile is not currently available on a public surface."
        }
        meta={
          profile
            ? [
                `${profile.totals.likes} likes`,
                `${profile.totals.saves} saves`,
                `${profile.totals.publicConcepts} published`,
              ]
            : ["Unavailable", "NeotypeLab"]
        }
        footer={
          profile
            ? "Public profile surface for published concepts, saves, and remix history"
            : "NeotypeLab public profile surface"
        }
        imageUrl={profile?.pilot.pictureUrl ?? leadConcept?.previewAsset?.publicUrl}
      />
    ),
    size
  );
}
