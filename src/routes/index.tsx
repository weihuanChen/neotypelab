import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { ExploreLanding } from "@/src/components/showcase/ExploreLanding";
import {
  buildShowcaseStructuredData,
  getShowcaseSnapshot,
  parseShowcaseSearch,
} from "@/src/lib/showcaseRouteData";

export const Route = createFileRoute("/")({
  validateSearch: parseShowcaseSearch,
  loader: () => getShowcaseSnapshot(),
  head: () => ({
    meta: [
      { title: "NeotypeLab" },
      {
        name: "description",
        content:
          "Explore public mecha repaint prototypes and start a structured create session.",
      },
      { property: "og:title", content: "NeotypeLab" },
      {
        property: "og:description",
        content:
          "Explore public mecha repaint prototypes and start a structured create session.",
      },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Home,
});

function Home() {
  const snapshot = Route.useLoaderData();
  const search = Route.useSearch();
  const structuredData = buildShowcaseStructuredData(snapshot);

  return (
    <AppShell
      description="Discover spray-ready repaint prototypes, then open or remix the systems behind them."
      title="Explore"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />
      <ExploreLanding search={search} snapshot={snapshot} />
    </AppShell>
  );
}
