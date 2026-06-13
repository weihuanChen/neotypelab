import { createFileRoute } from "@tanstack/react-router";
import { openGraphImageResponse } from "@/src/lib/og";

export const Route = createFileRoute("/showcase_/opengraph-image")({
  server: {
    handlers: {
      GET: () =>
        openGraphImageResponse({
          accent: "#3DD9FF",
          eyebrow: "Public Showcase",
          title: "Published mecha repaint prototypes",
          subtitle:
            "Browse public concepts, remix branches, and style-driven repaint planning surfaces.",
          meta: ["Trending", "Most Saved", "Remix Ready"],
          footer: "Structured showcase surfaces for hobby builders.",
        }),
    },
  },
});
