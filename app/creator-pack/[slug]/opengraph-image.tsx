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
  params: { slug: string };
}) {
  const pack = await fetchQuery(api.showcase.getCreatorPackBySlug, {
    slug: params.slug,
  });

  return new ImageResponse(
    (
      <OpenGraphImageCard
        accent="#3DD9FF"
        eyebrow="Creator Pack"
        title={pack ? pack.name : "Creator pack unavailable"}
        subtitle={
          pack
            ? `${pack.creator.fullName} · ${pack.styles.length} styles · ${pack.baseModels.length} base models`
            : "This creator pack is not currently available on a public surface."
        }
        meta={
          pack
            ? [
                `${pack.packType} pack`,
                `${pack.materials.length} materials`,
                `${pack.concepts.length} concepts`,
              ]
            : ["Unavailable", "NeotypeLab"]
        }
        footer={
          pack
            ? "Curated starter set for creator-owned Style DNA, compatible base models, and material presets"
            : "NeotypeLab creator pack surface"
        }
        imageUrl={pack?.concepts[0]?.previewAsset?.publicUrl ?? pack?.creator.pictureUrl}
      />
    ),
    size
  );
}
