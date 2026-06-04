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
        accent="#58FFB2"
        eyebrow="Creator Hub"
        title={profile ? `${profile.pilot.fullName}` : "Creator hub unavailable"}
        subtitle={
          profile
            ? `@${profile.pilot.handle} · ${profile.creatorPackCollection.length} packs · ${profile.styleCollection.length} styles`
            : "This creator hub is not currently available on a public surface."
        }
        meta={
          profile
            ? [
                `${profile.totals.publicConcepts} concepts`,
                `${profile.totals.remixes} remixes`,
                `${profile.totals.saves} saves`,
              ]
            : ["Unavailable", "NeotypeLab"]
        }
        footer={
          profile
            ? "Creator hub surface for packs, styles, and public concept output"
            : "NeotypeLab creator hub surface"
        }
        imageUrl={profile?.pilot.pictureUrl ?? leadConcept?.previewAsset?.publicUrl}
      />
    ),
    size
  );
}
