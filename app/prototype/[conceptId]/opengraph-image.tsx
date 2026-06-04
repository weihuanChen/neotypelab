import { ImageResponse } from "next/og";
import { fetchQuery } from "convex/nextjs";
import { OpenGraphImageCard } from "@/components/helpers/OpenGraphImageCard";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function OpenGraphImage({
  params,
}: {
  params: { conceptId: string };
}) {
  const concept = await fetchQuery(api.showcase.getSharedConcept, {
    conceptId: params.conceptId as Id<"concepts">,
  });

  return new ImageResponse(
    (
      <OpenGraphImageCard
        accent="#58FFB2"
        eyebrow="Prototype Share Surface"
        title={concept?.title ?? "Shared prototype unavailable"}
        subtitle={
          concept
            ? `${concept.baseModel?.name ?? "Unknown base model"} · ${concept.stylePreset?.name ?? "Unknown Style DNA"} · ${concept.materialPreset?.name ?? "Unknown material profile"}`
            : "This shared prototype is no longer available on a public or unlisted surface."
        }
        meta={
          concept
            ? [
                concept.weatheringLevel,
                `${concept.engagement.likeCount} likes`,
                `${concept.remixCount} remixes`,
              ]
            : ["Unavailable", "NeotypeLab"]
        }
        footer={
          concept?.owner
            ? `Pilot @${concept.owner.handle} · Built for remix and public discovery`
            : "NeotypeLab public concept surface"
        }
        imageUrl={concept?.previewAsset?.publicUrl}
      />
    ),
    size
  );
}
