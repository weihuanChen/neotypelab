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
  params: { baseModelSlug: string; stylePresetSlug: string };
}) {
  const landing = await fetchQuery(api.showcase.getSeoLandingPage, {
    baseModelSlug: params.baseModelSlug,
    stylePresetSlug: params.stylePresetSlug,
  });

  return new ImageResponse(
    (
      <OpenGraphImageCard
        accent="#3DD9FF"
        eyebrow="Style Landing Page"
        title={
          landing
            ? `${landing.baseModel.name} in ${landing.stylePreset.name}`
            : "Style landing page unavailable"
        }
        subtitle={
          landing
            ? `${landing.conceptCount} public concept${landing.conceptCount === 1 ? "" : "s"} · ${landing.aggregate.saves} saves · ${landing.aggregate.remixes} remix branches`
            : "This base model and Style DNA pairing does not yet have a public showcase surface."
        }
        meta={
          landing
            ? [
                landing.baseModel.grade ?? "Unknown grade",
                landing.stylePreset.category ?? "Uncategorized",
                `${landing.aggregate.likes} likes`,
              ]
            : ["Unavailable", "NeotypeLab"]
        }
        footer={
          landing
            ? "Public reference surface for style discovery, sharing, and remix entry"
            : "NeotypeLab SEO landing surface"
        }
        imageUrl={landing?.featuredConcept.previewAsset?.publicUrl}
      />
    ),
    size
  );
}
