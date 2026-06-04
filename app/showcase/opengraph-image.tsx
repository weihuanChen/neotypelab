import { ImageResponse } from "next/og";
import { OpenGraphImageCard } from "@/components/helpers/OpenGraphImageCard";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <OpenGraphImageCard
        accent="#3DD9FF"
        eyebrow="Public Showcase"
        title="Published mecha repaint prototypes"
        subtitle="Browse public concepts, remix branches, and style-driven repaint planning surfaces."
        meta={["Trending", "Most Saved", "Remix Ready"]}
        footer="Structured showcase surfaces for hobby builders."
      />
    ),
    size
  );
}
