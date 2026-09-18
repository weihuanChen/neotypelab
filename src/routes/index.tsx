import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { ExploreLanding } from "@/src/components/showcase/ExploreLanding";
import { SystemState, systemStates } from "@/src/components/system-state";
import {
  buildShowcaseStructuredData,
  getShowcaseSnapshot,
  parseShowcaseSearch,
} from "@/src/lib/showcaseRouteData";

const exploreShell = {
  description:
    "Discover spray-ready repaint prototypes, then open or remix the systems behind them.",
  title: "Explore",
} as const;

export const Route = createFileRoute("/")({
  validateSearch: parseShowcaseSearch,
  loader: () => getShowcaseSnapshot(),
  pendingComponent: ExplorePending,
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

function ExplorePending() {
  return (
    <AppShell {...exploreShell}>
      <SystemState {...systemStates.exploreLoading} />
    </AppShell>
  );
}

function Home() {
  const snapshot = Route.useLoaderData();
  const search = Route.useSearch();
  const structuredData = buildShowcaseStructuredData(snapshot);

  return (
    <AppShell {...exploreShell}>
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
