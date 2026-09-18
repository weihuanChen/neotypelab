import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { ShowcaseLanding } from "@/src/components/showcase/ShowcaseLanding";
import { SystemState, systemStates } from "@/src/components/system-state";
import {
  buildShowcaseStructuredData,
  getShowcaseSnapshot,
  parseShowcaseSearch,
} from "@/src/lib/showcaseRouteData";

const showcaseShell = {
  description: "Curated public repaint prototypes selected from the community.",
  title: "Showcase",
} as const;

export const Route = createFileRoute("/showcase")({
  validateSearch: parseShowcaseSearch,
  loader: () => getShowcaseSnapshot(),
  pendingComponent: ShowcasePending,
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

function ShowcasePending() {
  return (
    <AppShell {...showcaseShell}>
      <SystemState {...systemStates.showcaseLoading} />
    </AppShell>
  );
}

function ShowcaseRoute() {
  const snapshot = Route.useLoaderData();
  const search = Route.useSearch();
  const structuredData = buildShowcaseStructuredData(snapshot);

  return (
    <AppShell {...showcaseShell}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />
      <ShowcaseLanding search={search} snapshot={snapshot} />
    </AppShell>
  );
}
