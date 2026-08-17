import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { ShowcaseLanding } from "@/src/components/showcase/ShowcaseLanding";
import {
  buildShowcaseStructuredData,
  getShowcaseSnapshot,
  parseShowcaseSearch,
} from "@/src/lib/showcaseRouteData";

export const Route = createFileRoute("/showcase")({
  validateSearch: parseShowcaseSearch,
  loader: () => getShowcaseSnapshot(),
  head: () => ({
    meta: [
      { title: "NeotypeLab Showcase" },
      {
        name: "description",
        content:
          "Browse public mecha repaint prototypes, paint mapping plans, and community-ready Style DNA surfaces.",
      },
      { property: "og:title", content: "NeotypeLab Showcase" },
      {
        property: "og:description",
        content:
          "Browse public mecha repaint prototypes, paint mapping plans, and community-ready Style DNA surfaces.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/showcase" }],
  }),
  component: ShowcaseRoute,
});

function ShowcaseRoute() {
  const snapshot = Route.useLoaderData();
  const search = Route.useSearch();
  const structuredData = buildShowcaseStructuredData(snapshot);

  return (
    <AppShell
      description="Curated public repaint prototypes selected from the community."
      title="Showcase"
    >
      <main className="showcase-page">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />
        <ShowcaseLanding search={search} snapshot={snapshot} />
      </main>
    </AppShell>
  );
}
